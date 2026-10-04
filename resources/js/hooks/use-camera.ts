import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
    listCameras,
    markCameraResponsive,
    markCameraUnresponsive,
    openCameraStream,
    rememberCameraChoice,
} from '@/lib/mediapipe/camera-devices';
import type { CameraDevice } from '@/lib/mediapipe/camera-devices';
import type { CameraStatus } from '@/lib/mediapipe/types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Tiempo que se espera a que una cámara recién abierta entregue su primera
 * imagen. Abrirla no garantiza que funcione: un teléfono enlazado que no
 * está conectado, o una cámara virtual sin fuente, se abren y no envían nada.
 */
const FIRST_FRAME_TIMEOUT_MS = 10_000;

const FIRST_FRAME_POLL_MS = 100;

/** Por petición: la cámara pedida y, si no da imagen, la mejor del resto. */
const MAX_CAMERA_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/**
 * Motivo por el que no hay cámara, para que la interfaz pueda explicarlo:
 * - `denied`      → el usuario (o el navegador) negó el permiso.
 * - `no_image`    → las cámaras se abren pero ninguna entrega imagen.
 * - `unavailable` → no hay cámara o no se pudo abrir ninguna.
 */
export type CameraIssue = 'denied' | 'no_image' | 'unavailable';

type UseCameraOptions = {
    /** Ref del elemento <video> donde se conectará el stream. */
    videoRef: RefObject<HTMLVideoElement | null>;
};

type UseCameraReturn = {
    status: CameraStatus;
    /**
     * Abre la cámara y espera a que entregue imagen. Sin `deviceId` elige
     * la del propio equipo frente a cámaras virtuales o de un teléfono
     * enlazado (ver `camera-devices.ts`). Si la cámara no entrega imagen,
     * prueba con la mejor del resto antes de rendirse.
     */
    requestCamera: (deviceId?: string) => Promise<MediaStream | null>;
    stopCamera: () => void;
    /** Re-conecta el stream activo al videoRef actual (útil si el <video> se recrea). */
    reattachStream: () => void;
    error: string | null;
    /** Por qué no hay cámara, o null. Se conserva hasta el siguiente intento. */
    issue: CameraIssue | null;
    /**
     * Nombre de la cámara que se descartó en el último intento por no
     * entregar imagen, cuando se acabó usando otra. Null si no hubo descarte.
     */
    skippedCamera: string | null;
    /**
     * Cámaras disponibles, con el nombre que les da el sistema. Vacío hasta
     * que el usuario concede el permiso y se abre una cámara por primera vez.
     */
    cameras: CameraDevice[];
    /** `deviceId` de la cámara en uso, o null si no hay ninguna abierta. */
    activeCameraId: string | null;
    /**
     * Cambia de cámara a petición del usuario. Si hay una abierta la
     * sustituye en el mismo `<video>`, sin detener a quien lo consume.
     * Devuelve `false` si había que abrir una cámara y no se consiguió.
     */
    selectCamera: (deviceId: string) => Promise<boolean>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stopTracks(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
        track.stop();
    }
}

/**
 * Espera a que el `<video>` muestre la primera imagen del stream.
 *
 * Se sondea en lugar de esperar a `play()` o a un evento: con una cámara
 * que no entrega imagen la promesa de `play()` no se resuelve nunca, y un
 * evento perdido dejaría la espera colgada.
 *
 * @param shouldKeepWaiting Devuelve false si otra petición sustituyó a esta.
 */
function waitForFirstFrame(
    video: HTMLVideoElement,
    stream: MediaStream,
    shouldKeepWaiting: () => boolean,
): Promise<boolean> {
    const deadline = Date.now() + FIRST_FRAME_TIMEOUT_MS;

    return new Promise((resolve) => {
        const check = () => {
            if (
                video.srcObject === stream &&
                video.readyState >= 2 &&
                video.videoWidth > 0
            ) {
                resolve(true);

                return;
            }

            if (!shouldKeepWaiting() || Date.now() >= deadline) {
                resolve(false);

                return;
            }

            setTimeout(check, FIRST_FRAME_POLL_MS);
        };

        setTimeout(check, FIRST_FRAME_POLL_MS);
    });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Gestiona el ciclo de vida de un MediaStream de cámara.
 *
 * Recibe un `videoRef` externo del componente consumidor en lugar de
 * crear uno interno, evitando mutaciones cruzadas de refs entre hooks.
 */
export function useCamera({ videoRef }: UseCameraOptions): UseCameraReturn {
    const [status, setStatus] = useState<CameraStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [issue, setIssue] = useState<CameraIssue | null>(null);
    const [skippedCamera, setSkippedCamera] = useState<string | null>(null);
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Cada petición recibe un número. Si llega otra (o se detiene la cámara)
    // mientras una espera, la antigua lo detecta y se retira sin tocar nada.
    const requestIdRef = useRef(0);

    const requestCamera = useCallback(
        async (deviceId?: string): Promise<MediaStream | null> => {
            const requestId = ++requestIdRef.current;
            const isCurrent = () => requestIdRef.current === requestId;

            // Detener stream previo si existe (evita resource leak si se llama dos veces).
            if (streamRef.current) {
                stopTracks(streamRef.current);
                streamRef.current = null;
            }

            setStatus('requesting');
            setError(null);
            setIssue(null);
            setSkippedCamera(null);

            let requested = typeof deviceId === 'string' ? deviceId : undefined;
            let skipped: string | null = null;

            try {
                for (
                    let attempt = 0;
                    attempt < MAX_CAMERA_ATTEMPTS;
                    attempt++
                ) {
                    const mediaStream = await openCameraStream(requested);

                    if (!isCurrent()) {
                        stopTracks(mediaStream);

                        return null;
                    }

                    const track = mediaStream.getVideoTracks()[0];
                    const openedId = track?.getSettings().deviceId ?? null;
                    const video = videoRef.current;

                    streamRef.current = mediaStream;

                    if (video) {
                        video.srcObject = mediaStream;
                        // Sin await: con una cámara que no entrega imagen
                        // esta promesa no se resuelve nunca.
                        video.play().catch(() => {});

                        const hasImage = await waitForFirstFrame(
                            video,
                            mediaStream,
                            isCurrent,
                        );

                        if (!isCurrent()) {
                            stopTracks(mediaStream);

                            return null;
                        }

                        if (!hasImage) {
                            stopTracks(mediaStream);
                            streamRef.current = null;
                            video.srcObject = null;

                            if (openedId) markCameraUnresponsive(openedId);
                            skipped = track?.label || skipped;
                            requested = undefined;

                            const others = await listCameras().catch(() => []);
                            if (
                                !others.some(
                                    (camera) => camera.deviceId !== openedId,
                                )
                            ) {
                                break;
                            }

                            continue;
                        }
                    }

                    const available = await listCameras().catch(() => []);

                    if (!isCurrent()) {
                        stopTracks(mediaStream);

                        return null;
                    }

                    if (openedId) markCameraResponsive(openedId);
                    setActiveCameraId(openedId);
                    // Con el permiso concedido ya hay nombres: alimentan el
                    // selector de cámara.
                    setCameras(available);
                    setSkippedCamera(skipped);
                    setStatus('active');

                    return mediaStream;
                }

                if (!isCurrent()) return null;

                setActiveCameraId(null);
                setStatus('error');
                setIssue('no_image');
                setError('The camera is not sending any image.');

                return null;
            } catch (err) {
                if (!isCurrent()) return null;

                setActiveCameraId(null);

                if (
                    err instanceof DOMException &&
                    err.name === 'NotAllowedError'
                ) {
                    setStatus('denied');
                    setIssue('denied');
                    setError('Camera permission denied by user.');
                } else {
                    setStatus('error');
                    setIssue('unavailable');
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Camera access failed',
                    );
                }

                return null;
            }
        },
        [videoRef],
    );

    const selectCamera = useCallback(
        async (deviceId: string): Promise<boolean> => {
            rememberCameraChoice(deviceId);

            if (!streamRef.current) return true;

            return (await requestCamera(deviceId)) !== null;
        },
        [requestCamera],
    );

    const reattachStream = useCallback(() => {
        if (
            streamRef.current &&
            videoRef.current &&
            videoRef.current.srcObject !== streamRef.current
        ) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => {});
        }
    }, [videoRef]);

    const stopCamera = useCallback(() => {
        // Invalida cualquier petición que siga esperando una imagen.
        requestIdRef.current += 1;

        if (streamRef.current) {
            stopTracks(streamRef.current);
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setActiveCameraId(null);
        setStatus('idle');
        setError(null);
    }, [videoRef]);

    return {
        status,
        requestCamera,
        stopCamera,
        reattachStream,
        error,
        issue,
        skippedCamera,
        cameras,
        activeCameraId,
        selectCamera,
    };
}
