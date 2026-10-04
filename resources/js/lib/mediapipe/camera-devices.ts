/**
 * Elección de la cámara para el motor de gestos.
 *
 * Pedir "una cámara" sin más deja la decisión al navegador, que usa su
 * cámara por defecto. En un portátil con el teléfono enlazado (Enlace Móvil
 * de Windows, Continuity Camera de macOS) o con software de cámara virtual,
 * esa cámara por defecto puede no ser la del propio equipo: el portal
 * acababa encendiendo la cámara del teléfono.
 *
 * Aquí se decide antes de abrir nada, siempre que el navegador ya conozca
 * los nombres de las cámaras (permiso concedido en una visita anterior):
 *
 *   1. La que el usuario eligió a mano en esta sesión del navegador.
 *   2. Si hay cámaras de distinta clase, la del propio equipo frente a las
 *      virtuales o de teléfono.
 *   3. En cualquier otro caso, la que decida el navegador pidiendo la
 *      frontal — imprescindible en móviles, donde todas son "del equipo".
 *
 * Privacidad: la elección vive solo en memoria. No se escribe en cookies,
 * `localStorage` ni servidor, así que no añade nada a la política de cookies.
 *
 * Sin dependencias de React — utilizable desde cualquier hook.
 */

// ---------------------------------------------------------------------------
// Tipos y constantes
// ---------------------------------------------------------------------------

export type CameraDevice = {
    deviceId: string;
    /** Nombre que da el sistema operativo a la cámara. */
    label: string;
};

const VIDEO_SIZE = {
    width: { ideal: 640 },
    height: { ideal: 480 },
} as const;

/**
 * Cámaras que no son la del propio equipo: virtuales, de software o un
 * teléfono enlazado. Windows nombra la del teléfono como
 * "<modelo> (Windows Virtual Camera)".
 */
const REMOTE_OR_VIRTUAL_CAMERA =
    /virtual|phone link|enlace m[oó]vil|droidcam|iriun|epoccam|ivcam|\bcamo\b|\bndi\b|manycam|xsplit|snap camera|mmhmm|iphone|ipad/i;

/**
 * Señales de una cámara física del equipo: el sufijo "(vid:pid)" que los
 * navegadores Chromium añaden a las cámaras USB (las integradas de un
 * portátil lo son) y los nombres habituales de las integradas.
 */
const BUILT_IN_OR_USB_CAMERA =
    /\([0-9a-f]{4}:[0-9a-f]{4}\)|integrated|integrada|built-?in|webcam|facetime|\buvc\b/i;

/** Cámara elegida a mano por el usuario. Dura lo que la pestaña. */
let chosenCameraId: string | null = null;

// ---------------------------------------------------------------------------
// Elección
// ---------------------------------------------------------------------------

/** Recuerda, solo en memoria, la cámara que el usuario eligió a mano. */
export function rememberCameraChoice(deviceId: string): void {
    chosenCameraId = deviceId;
}

/**
 * Cámaras con nombre. Devuelve una lista vacía mientras el usuario no haya
 * concedido el permiso: hasta entonces el navegador oculta nombres e ids.
 */
export async function listCameras(): Promise<CameraDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices
        .filter(
            (device) =>
                device.kind === 'videoinput' &&
                device.deviceId !== '' &&
                device.label !== '',
        )
        .map(({ deviceId, label }) => ({ deviceId, label }));
}

/** 1 = cámara del equipo, -1 = virtual o de teléfono, 0 = no se sabe. */
function scoreCamera(label: string): number {
    if (REMOTE_OR_VIRTUAL_CAMERA.test(label)) return -1;
    if (BUILT_IN_OR_USB_CAMERA.test(label)) return 1;

    return 0;
}

/** Cámaras ordenadas de más a menos probable que sea la del propio equipo. */
function byPreference(cameras: readonly CameraDevice[]): CameraDevice[] {
    return [...cameras].sort(
        (a, b) => scoreCamera(b.label) - scoreCamera(a.label),
    );
}

/**
 * Cámara que conviene abrir, o `null` si es mejor dejar decidir al navegador.
 *
 * Solo se impone una cámara cuando hay diferencia real entre las
 * disponibles. En un móvil (frontal y trasera, ninguna virtual) todas
 * puntúan igual y manda `facingMode: 'user'`.
 */
export function pickPreferredCamera(
    cameras: readonly CameraDevice[],
    chosenDeviceId: string | null = chosenCameraId,
): string | null {
    if (
        chosenDeviceId !== null &&
        cameras.some((camera) => camera.deviceId === chosenDeviceId)
    ) {
        return chosenDeviceId;
    }

    if (cameras.length < 2) return null;

    const ranked = byPreference(cameras);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];

    return scoreCamera(best.label) > scoreCamera(worst.label)
        ? best.deviceId
        : null;
}

// ---------------------------------------------------------------------------
// Apertura
// ---------------------------------------------------------------------------

function open(deviceId: string | null): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
        video:
            deviceId === null
                ? { ...VIDEO_SIZE, facingMode: 'user' }
                : { ...VIDEO_SIZE, deviceId: { exact: deviceId } },
        audio: false,
    });
}

function stop(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
        track.stop();
    }
}

/** El usuario (o la política del sitio) denegó la cámara: no hay nada que reintentar. */
function isPermissionError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'NotAllowedError';
}

/**
 * Abre la cámara adecuada para el motor de gestos.
 *
 * @param requestedDeviceId Cámara concreta pedida por el usuario. Si no se
 *                          puede abrir (desconectada, en uso) se recurre a
 *                          la elección automática.
 * @throws DOMException `NotAllowedError` si el usuario deniega el permiso;
 *                      el error original si ninguna cámara puede abrirse.
 */
export async function openCameraStream(
    requestedDeviceId?: string,
): Promise<MediaStream> {
    const preferred =
        requestedDeviceId ?? pickPreferredCamera(await listCameras());

    if (preferred !== null) {
        try {
            return await open(preferred);
        } catch (error) {
            if (isPermissionError(error)) throw error;
        }
    }

    let stream: MediaStream;

    try {
        stream = await open(null);
    } catch (error) {
        if (isPermissionError(error)) throw error;

        // La cámara por defecto del navegador no responde (por ejemplo, un
        // teléfono enlazado que está apagado): probamos la mejor del resto.
        const fallback = byPreference(await listCameras())[0];
        if (fallback === undefined || fallback.deviceId === preferred) {
            throw error;
        }

        return open(fallback.deviceId);
    }

    // Primera vez: hasta conceder el permiso no había nombres con los que
    // elegir. Ahora sí. Si el navegador abrió una cámara virtual o de
    // teléfono habiendo otra mejor, cambiamos a esa — salvo que sea la que
    // acaba de fallar arriba.
    const better = pickPreferredCamera(await listCameras());
    const opened = stream.getVideoTracks()[0]?.getSettings().deviceId;

    if (better === null || better === opened || better === preferred) {
        return stream;
    }

    try {
        const replacement = await open(better);
        stop(stream);

        return replacement;
    } catch {
        return stream;
    }
}
