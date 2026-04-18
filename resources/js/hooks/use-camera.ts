import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { CameraStatus } from '@/lib/mediapipe/types';

type UseCameraOptions = {
    /** Ref del elemento <video> donde se conectará el stream. */
    videoRef: RefObject<HTMLVideoElement | null>;
};

type UseCameraReturn = {
    status: CameraStatus;
    requestCamera: () => Promise<MediaStream | null>;
    stopCamera: () => void;
    /** Re-conecta el stream activo al videoRef actual (útil si el <video> se recrea). */
    reattachStream: () => void;
    error: string | null;
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
    const streamRef = useRef<MediaStream | null>(null);

    const requestCamera = useCallback(async (): Promise<MediaStream | null> => {
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
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
                audio: false,
            });

            streamRef.current = mediaStream;

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                await videoRef.current.play();
            }

            setStatus('active');
            return mediaStream;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setStatus('denied');
                setError('Camera permission denied by user.');
            } else {
                setStatus('error');
                setError(
                    err instanceof Error ? err.message : 'Camera access failed',
                );
            }
            return null;
        }
    }, [videoRef]);

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

        setStatus('idle');
        setError(null);
    }, [videoRef]);

    return { status, requestCamera, stopCamera, reattachStream, error };
}
