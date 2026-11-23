import type { FacePoint } from '@/lib/mediapipe/face-measures';

/**
 * Los 478 puntos de una cara de frente con los labios separados `gapRatio`
 * veces la distancia entre los rabillos de los ojos. `scale` acerca (> 1) o
 * aleja (< 1) la cara de la cámara.
 */
export function faceWithLipGap(gapRatio: number, scale = 1): FacePoint[] {
    const points: FacePoint[] = Array.from({ length: 478 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
    }));
    const eyeHalf = 0.14 * scale;
    // En píxeles: los ojos se separan en horizontal (×320) y los labios en
    // vertical (×240).
    const eyesPx = eyeHalf * 2 * 320;
    const gapY = (gapRatio * eyesPx) / 240;

    points[33] = { x: 0.5 - eyeHalf, y: 0.45, z: 0 };
    points[263] = { x: 0.5 + eyeHalf, y: 0.45, z: 0 };
    points[13] = { x: 0.5, y: 0.7, z: 0 };
    points[14] = { x: 0.5, y: 0.7 + gapY, z: 0 };

    return points;
}
