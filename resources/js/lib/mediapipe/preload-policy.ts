/**
 * Cuándo se adelanta trabajo del control facial antes de que el usuario lo
 * active. Es la única decisión de precarga de la aplicación: el resto solo
 * ejecuta lo que dice aquí.
 *
 * Principios:
 *
 *   1. **Solo para quien usa el control facial.** Con el perfil "no uso la
 *      cámara" no se descarga nada, en ninguna página: el control facial es
 *      un añadido y quien juega con teclado no debe pagar por él.
 *   2. **Solo donde se va a usar, y solo en juegos que lo admiten.** En la
 *      página de juego se prepara el motor (sin cámara). En las páginas desde
 *      las que se entra a jugar (ficha del juego, "Seguir jugando") solo se
 *      descargan los ficheros a la caché: ni CPU ni memoria. En el resto,
 *      nada. Un juego que no recibe los controles de Vout no adelanta nada.
 *   3. **Quien juega con la cámara (`primary`) lo tiene listo antes.** En la
 *      ficha de un juego compatible ya se prepara el motor, y en la página de
 *      juego aunque aún no tenga perfil (lo normal es que lo pruebe).
 *   4. **Respetar el equipo.** Con el ahorro de datos, una conexión lenta o
 *      poca memoria no se adelanta nada: el motor se carga al pulsar
 *      "Activar", como siempre.
 *   5. **La cámara nunca.** Abrirla es siempre decisión del usuario (el
 *      encendido automático, que también lo es, no pasa por aquí).
 *
 * Sin DOM ni React: las pistas del equipo se leen con `readDeviceHints`.
 */

/**
 * Lo que el usuario ha dicho del control facial (su perfil de uso):
 * - `none`    → no usa la cámara.
 * - `enabled` → la usa a veces.
 * - `primary` → juega con la cámara.
 */
export type FacialControlIntent = 'none' | 'enabled' | 'primary';

/**
 * Dónde se está:
 * - `play`        → la página de un juego.
 * - `game-detail` → la ficha de un juego (desde ella se entra a jugarlo).
 * - `game-entry`  → otra página desde la que se entra a jugar ("Seguir
 *                   jugando").
 * - `setup`       → el asistente que configura el control facial.
 */
export type PreloadContext = 'play' | 'game-detail' | 'game-entry' | 'setup';

/**
 * - `none`     → nada.
 * - `prefetch` → descargar los ficheros de MediaPipe a la caché del navegador.
 * - `warm`     → preparar el motor (worker, WASM, modelo y GPU) sin cámara.
 */
export type PreloadDecision = 'none' | 'prefetch' | 'warm';

export type DeviceHints = {
    /** El usuario pidió ahorrar datos. */
    saveData: boolean;
    /** Conexión 2G o peor. */
    slowNetwork: boolean;
    /** 2 GB de memoria o menos. */
    lowMemory: boolean;
};

export const NO_DEVICE_LIMITS: DeviceHints = {
    saveData: false,
    slowNetwork: false,
    lowMemory: false,
};

/** Memoria (GB, `navigator.deviceMemory`) por debajo de la que no se precarga. */
const LOW_MEMORY_GB = 2;

const SLOW_CONNECTIONS = new Set(['slow-2g', '2g']);

export type PreloadSignals = {
    intent: FacialControlIntent;
    context: PreloadContext;
    /** Tiene un perfil de gestos (sin él no se puede activar en el juego). */
    hasProfile: boolean;
    /**
     * Si el juego de la página recibe los controles de Vout (`play` y
     * `game-detail`). Donde no hay un juego concreto, true.
     */
    gameSupportsFacialControl?: boolean;
    device: DeviceHints;
};

export function decidePreload({
    intent,
    context,
    hasProfile,
    gameSupportsFacialControl = true,
    device,
}: PreloadSignals): PreloadDecision {
    if (intent === 'none') {
        return 'none';
    }

    // En un juego que no recibe los controles, la cámara no haría nada.
    if (!gameSupportsFacialControl) {
        return 'none';
    }

    // Descargar cuesta datos; preparar el motor, además, memoria.
    if (device.saveData || device.slowNetwork) {
        return 'none';
    }

    if (context === 'game-entry') {
        return 'prefetch';
    }

    if (context === 'game-detail') {
        return intent === 'primary' && !device.lowMemory ? 'warm' : 'prefetch';
    }

    if (device.lowMemory) {
        return 'none';
    }

    if (context === 'play' && !hasProfile && intent !== 'primary') {
        return 'none';
    }

    return 'warm';
}

const INTENT_BY_USAGE: Record<string, FacialControlIntent> = {
    off: 'none',
    occasional: 'enabled',
    primary: 'primary',
};

/** La intención a partir de los ajustes del usuario (null sin sesión). */
export function facialControlIntent(
    settings: { facial_control_usage?: string | null } | null | undefined,
): FacialControlIntent {
    return INTENT_BY_USAGE[settings?.facial_control_usage ?? 'off'] ?? 'none';
}

/** Lo que este módulo lee de `navigator` (Network Information y Device Memory). */
export type NavigatorHintsLike = {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
};

/**
 * Pistas del equipo. Son APIs de Chromium: en otros navegadores no existen y
 * se asume que no hay límites.
 */
export function readDeviceHints(
    navigatorLike: NavigatorHintsLike | undefined = globalThis.navigator as
        NavigatorHintsLike | undefined,
): DeviceHints {
    const connection = navigatorLike?.connection;
    const memory = navigatorLike?.deviceMemory;

    return {
        saveData: connection?.saveData === true,
        slowNetwork:
            connection?.effectiveType !== undefined &&
            SLOW_CONNECTIONS.has(connection.effectiveType),
        lowMemory: typeof memory === 'number' && memory <= LOW_MEMORY_GB,
    };
}
