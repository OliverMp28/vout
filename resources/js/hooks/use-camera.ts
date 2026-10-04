import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
    listCameras,
    openCameraStream,
    rememberCameraChoice,
} from '@/lib/mediapipe/camera-devices';
import type { CameraDevice } from '@/lib/mediapipe/camera-devices';
import type { CameraStatus } from '@/lib/mediapipe/types';

type UseCameraOptions = {
    /** Ref del elemento <video> donde se conectará el stream. */
    videoRef: RefObject<HTMLVideoElement | null>;
};

type UseCameraReturn = {
    status: CameraStatus;
    /**
     * Abre la cámara. Sin `deviceId` elige la del propio equipo frente a
     * cámaras virtuales o de un teléfono enlazado (ver `camera-devices.ts`).
     */
    requestCamera: (deviceId?: string) => Promise<MediaStream | null>;
    stopCamera: () => void;
    /** Re-conecta el stream activo al videoRef actual (útil si el <video> se recrea). */
    reattachStream: () => void;
    error: string | null;
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
     */
    selectCamera: (deviceId: string) => Promise<void>;
};

/**
 * Gestiona el ciclo de vida de un MediaStream de cámara.
 *
 * Recibe un `videoRef` externo del componente consumidor en lugar de
 * crear uno interno, evitando mutaciones cruzadas de refs entre hooks.
 */
export function useCamera({ videoRef }: UseCameraOptions): UseCameraReturn {
    const [status, setStatus] = useState<CameraStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const requestCamera = useCallback(
        async (deviceId?: string): Promise<MediaStream | null> => {
            // Detener stream previo si existe (evita resource leak si se llama dos veces).
            if (streamRef.current) {
                for (const track of streamRef.current.getTracks()) {
                    track.stop();
                }
                streamRef.current = null;
            }

            setStatus('requesting');
            setError(null);

            try {
                const mediaStream = await openCameraStream(
                    typeof deviceId === 'string' ? deviceId : undefined,
                );

                streamRef.current = mediaStream;

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    await videoRef.current.play();
                }

                setActiveCameraId(
                    mediaStream.getVideoTracks()[0]?.getSettings().deviceId ??
                        null,
                );
                // Con el permiso concedido ya hay nombres: alimentan el
                // selector de cámara. Si falla, el selector no se muestra.
                setCameras(await listCameras().catch(() => []));
                setStatus('active');

                return mediaStream;
            } catch (err) {
                setActiveCameraId(null);

                if (
                    err instanceof DOMException &&
                    err.name === 'NotAllowedError'
                ) {
                    setStatus('denied');
                    setError('Camera permission denied by user.');
                } else {
                    setStatus('error');
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
        async (deviceId: string): Promise<void> => {
            rememberCameraChoice(deviceId);

            if (streamRef.current) {
                await requestCamera(deviceId);
            }
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
        if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) {
                track.stop();
            }
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
        cameras,
        activeCameraId,
        selectCamera,
    };
}
