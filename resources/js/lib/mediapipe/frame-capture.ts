/**
 * Captura de la imagen de la cámara que se envía al worker.
 */

import { CAPTURE_WIDTH } from './constants';

/** Tamaño de captura que respeta la proporción de la cámara. */
export function captureSize(
    videoWidth: number,
    videoHeight: number,
    width: number = CAPTURE_WIDTH,
): { width: number; height: number } {
    if (videoWidth <= 0 || videoHeight <= 0) {
        return { width, height: Math.round((width * 3) / 4) };
    }

    return {
        width,
        height: Math.max(1, Math.round((width * videoHeight) / videoWidth)),
    };
}

/**
 * Copia la imagen actual del `<video>` a un `ImageBitmap` reducido, listo
 * para transferirse al worker sin copias. Devuelve null si el vídeo aún no
 * tiene imagen.
 */
export async function captureVideoFrame(
    video: HTMLVideoElement | null,
): Promise<ImageBitmap | null> {
    if (video === null || video.readyState < 2 || video.videoWidth === 0) {
        return null;
    }

    const size = captureSize(video.videoWidth, video.videoHeight);

    return createImageBitmap(video, {
        resizeWidth: size.width,
        resizeHeight: size.height,
    });
}
