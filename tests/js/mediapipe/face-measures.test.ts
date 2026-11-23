import { describe, expect, test } from 'bun:test';

import {
    LIPS_APART_KEY,
    LIPS_FULL_GAP_RATIO,
    measureLipsApart,
} from '@/lib/mediapipe/face-measures';
import type { FacePoint } from '@/lib/mediapipe/face-measures';

import { faceWithLipGap } from './support/face-points';

const IMAGE = { width: 320, height: 240 };

describe('measureLipsApart', () => {
    test('con los labios juntos es 0', () => {
        expect(measureLipsApart(faceWithLipGap(0), IMAGE)).toBe(0);
    });

    test('mide la separación relativa a la distancia entre los ojos', () => {
        // La mitad de la separación que cuenta como "del todo".
        expect(
            measureLipsApart(faceWithLipGap(LIPS_FULL_GAP_RATIO / 2), IMAGE),
        ).toBeCloseTo(0.5, 5);
    });

    test('a partir de ~9 mm satura en 1', () => {
        expect(measureLipsApart(faceWithLipGap(0.4), IMAGE)).toBe(1);
    });

    test('no cambia con la distancia a la cámara', () => {
        const near = measureLipsApart(faceWithLipGap(0.04, 1.4), IMAGE);
        const far = measureLipsApart(faceWithLipGap(0.04, 0.6), IMAGE);

        expect(near).toBeCloseTo(far!, 5);
    });

    test('cuenta la profundidad (cabeza inclinada)', () => {
        const points = faceWithLipGap(0);

        // El labio inferior se separa solo en profundidad.
        points[14] = { ...points[14], z: (0.04 * 0.28) / 1 };

        expect(measureLipsApart(points, IMAGE)).toBeCloseTo(0.4, 5);
    });

    test('sin los puntos que necesita, null', () => {
        expect(measureLipsApart([{ x: 0.5, y: 0.5 }], IMAGE)).toBeNull();

        const sameEyes: FacePoint[] = faceWithLipGap(0.02);
        sameEyes[263] = sameEyes[33];

        expect(measureLipsApart(sameEyes, IMAGE)).toBeNull();
    });

    test('tiene su propia clave en el mapa de señales', () => {
        expect(LIPS_APART_KEY).toBe('lipsApart');
    });
});
