import { describe, expect, test } from 'bun:test';

import { NeutralCalibration } from '@/lib/mediapipe/neutral-calibration';
import type { CalibrationFrame } from '@/lib/mediapipe/neutral-calibration';
import type { HeadPose } from '@/lib/mediapipe/types';

const FRONT: HeadPose = { yaw: 0, pitch: 0, roll: 0, timestamp: 0 };
const RELAXED = { jawOpen: 0.05, browInnerUp: 0.1, eyeBlinkLeft: 0.2 };

function calibration() {
    return new NeutralCalibration({
        frameCount: 3,
        timeoutMs: 1000,
        maxHeadRotation: 0.4,
        relaxedMax: 0.45,
    });
}

function frame(
    timestamp: number,
    overrides: Partial<CalibrationFrame> = {},
): CalibrationFrame {
    return { timestamp, blendshapes: RELAXED, headPose: FRONT, ...overrides };
}

describe('NeutralCalibration', () => {
    test('promedia los fotogramas de frente y relajados', () => {
        const neutral = calibration();

        expect(neutral.addFrame(frame(0))).toEqual({ status: 'collecting' });
        expect(
            neutral.addFrame(
                frame(33, { blendshapes: { ...RELAXED, jawOpen: 0.11 } }),
            ),
        ).toEqual({ status: 'collecting' });

        const result = neutral.addFrame(frame(66));

        expect(result.status).toBe('done');

        if (result.status === 'done') {
            expect(result.baseline.blendshapes.jawOpen).toBeCloseTo(0.07);
            expect(result.baseline.blendshapes.browInnerUp).toBeCloseTo(0.1);
        }
    });

    test('ignora los fotogramas con la cabeza girada', () => {
        const neutral = calibration();
        const turned = { ...FRONT, pitch: 0.6 };
        const nodding = { ...FRONT, roll: -0.5 };

        neutral.addFrame(frame(0, { headPose: turned }));
        neutral.addFrame(frame(33, { headPose: nodding }));
        neutral.addFrame(frame(66));
        neutral.addFrame(frame(99));

        expect(neutral.addFrame(frame(132)).status).toBe('done');
    });

    test('ignora los fotogramas con la cara en tensión', () => {
        const neutral = calibration();

        neutral.addFrame(
            frame(0, { blendshapes: { ...RELAXED, mouthSmileLeft: 0.7 } }),
        );
        neutral.addFrame(frame(33));
        neutral.addFrame(frame(66));

        expect(neutral.addFrame(frame(99)).status).toBe('done');
    });

    test('un blendshape que el clasificador no usa no cuenta como tensión', () => {
        const neutral = calibration();

        neutral.addFrame(
            frame(0, { blendshapes: { ...RELAXED, cheekPuff: 0.9 } }),
        );
        neutral.addFrame(frame(33));

        expect(neutral.addFrame(frame(66)).status).toBe('done');
    });

    test.each([
        ['no_face', { blendshapes: null }],
        ['not_frontal', { headPose: { ...FRONT, pitch: 0.9 } }],
        ['not_relaxed', { blendshapes: { ...RELAXED, jawOpen: 0.8 } }],
    ] as const)(
        'si se agota el tiempo falla con el motivo más frecuente: %s',
        (reason, overrides) => {
            const neutral = calibration();

            neutral.addFrame(frame(0, overrides));
            neutral.addFrame(frame(500, overrides));

            expect(neutral.addFrame(frame(1000, overrides))).toEqual({
                status: 'failed',
                reason,
            });
        },
    );

    test('timeout si los fotogramas valían pero no llegaron bastantes', () => {
        const neutral = calibration();

        neutral.addFrame(frame(0));

        expect(neutral.addFrame(frame(1000))).toEqual({
            status: 'failed',
            reason: 'timeout',
        });
    });

    test('sin pose de la cabeza se acepta el fotograma si la cara está relajada', () => {
        const neutral = calibration();

        neutral.addFrame(frame(0, { headPose: null }));
        neutral.addFrame(frame(33, { headPose: null }));

        const result = neutral.addFrame(frame(66, { headPose: null }));

        expect(result.status).toBe('done');

        if (result.status === 'done') {
            expect(result.baseline.headPose).toBeUndefined();
        }
    });

    test('guarda la postura media de los fotogramas válidos como frente', () => {
        const neutral = calibration();

        // Cámara encima de la pantalla: la cabeza se ve algo bajada.
        neutral.addFrame(frame(0, { headPose: { ...FRONT, roll: -0.1 } }));
        neutral.addFrame(frame(33, { headPose: { ...FRONT, pitch: 0.9 } }));
        neutral.addFrame(
            frame(66, { headPose: { ...FRONT, pitch: 0.06, roll: -0.2 } }),
        );

        const result = neutral.addFrame(frame(99, { headPose: null }));

        expect(result.status).toBe('done');

        if (result.status === 'done') {
            expect(result.baseline.headPose?.pitch).toBeCloseTo(0.03);
            expect(result.baseline.headPose?.roll).toBeCloseTo(-0.15);
        }
    });
});
