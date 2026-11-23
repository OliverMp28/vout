import { describe, expect, test } from 'bun:test';

import {
    CALIBRATION_FRAME_COUNT,
    CALIBRATION_TIMEOUT_MS,
    FACE_LOST_RELEASE_MS,
} from '@/lib/mediapipe/constants';
import {
    DetectionSession,
    blendshapeMapFromResult,
} from '@/lib/mediapipe/detection-session';
import type { LandmarkerResultLike } from '@/lib/mediapipe/detection-session';
import { LIPS_APART_KEY } from '@/lib/mediapipe/face-measures';
import type { FacePoint } from '@/lib/mediapipe/face-measures';
import { USED_BLENDSHAPE_KEYS } from '@/lib/mediapipe/gesture-rules';
import { GestureType } from '@/lib/mediapipe/types';

import { faceWithLipGap } from './support/face-points';

/** Matriz de transformación sin giro (cabeza de frente). */
const FRONTAL = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Un resultado de MediaPipe con cara y estos blendshapes (el resto a 0). */
function face(
    scores: Record<string, number> = {},
    points: FacePoint[] = [{ x: 0.5, y: 0.5 }],
): LandmarkerResultLike {
    const names = new Set([
        ...USED_BLENDSHAPE_KEYS,
        'cheekPuff',
        ...Object.keys(scores),
    ]);

    return {
        faceLandmarks: [points],
        faceBlendshapes: [
            {
                categories: [...names].map((categoryName) => ({
                    categoryName,
                    score: scores[categoryName] ?? 0,
                })),
            },
        ],
        facialTransformationMatrixes: [{ data: FRONTAL }],
    };
}

const NO_FACE: LandmarkerResultLike = { faceLandmarks: [] };

const MOUTH_OPEN = { jawOpen: 0.95 };

function session(enableBlendshapes = false): DetectionSession {
    return new DetectionSession(1, { sensitivity: 5, enableBlendshapes });
}

function phases(events: { gesture: string; phase: string }[]): string[] {
    return events.map((event) => `${event.gesture}:${event.phase}`);
}

describe('blendshapeMapFromResult', () => {
    const categories = [
        {
            categories: [
                { categoryName: 'jawOpen', score: 0.4 },
                { categoryName: 'cheekPuff', score: 0.2 },
            ],
        },
    ];

    test('en juego solo devuelve los que usa el clasificador', () => {
        expect(blendshapeMapFromResult(categories, false)).toEqual({
            jawOpen: 0.4,
        });
    });

    test('en Vision Lab, todos', () => {
        expect(blendshapeMapFromResult(categories, true)).toEqual({
            jawOpen: 0.4,
            cheekPuff: 0.2,
        });
    });

    test('sin categorías, vacío', () => {
        expect(blendshapeMapFromResult([], true)).toEqual({});
    });
});

describe('DetectionSession', () => {
    test('con cara clasifica gestos y da la pose', () => {
        const analysis = session().analyse(face(MOUTH_OPEN), 100);

        expect(phases(analysis.gestures)).toEqual([
            `${GestureType.MouthOpen}:start`,
        ]);
        expect(analysis.headPose).toMatchObject({ timestamp: 100 });
        expect(analysis.calibration).toBeNull();
    });

    test('los blendshapes solo salen con enableBlendshapes', () => {
        expect(session(false).analyse(face(), 0).blendshapes).toBeNull();
        expect(session(true).analyse(face(), 0).blendshapes).toMatchObject({
            cheekPuff: 0,
        });
    });

    test('la configuración se puede cambiar a mitad de sesión', () => {
        const current = session(false);

        current.updateConfig({ enableBlendshapes: true });

        expect(current.analyse(face(), 0).blendshapes).not.toBeNull();
    });

    test('sin cara, los gestos activos terminan pasado el margen', () => {
        const current = session();

        current.analyse(face(MOUTH_OPEN), 0);

        expect(current.analyse(NO_FACE, 10).gestures).toEqual([]);
        expect(
            current.analyse(NO_FACE, 10 + FACE_LOST_RELEASE_MS - 1).gestures,
        ).toEqual([]);

        const released = current.analyse(NO_FACE, 10 + FACE_LOST_RELEASE_MS);

        expect(phases(released.gestures)).toEqual([
            `${GestureType.MouthOpen}:end`,
        ]);
        // El final lleva la marca de cuando se dejó de ver la cara.
        expect(released.gestures[0].timestamp).toBe(10);
        expect(released.headPose).toBeNull();
    });

    test('al volver la cara se reinicia la cuenta', () => {
        const current = session();

        current.analyse(face(MOUTH_OPEN), 0);
        current.analyse(NO_FACE, 10);
        current.analyse(face(MOUTH_OPEN), 100);

        expect(
            current.analyse(NO_FACE, 10 + FACE_LOST_RELEASE_MS).gestures,
        ).toEqual([]);
    });

    test('mientras calibra no clasifica y termina los gestos activos', () => {
        const current = session(true);

        current.analyse(face(MOUTH_OPEN), 0);
        current.startCalibration();

        const analysis = current.analyse(face(MOUTH_OPEN), 33);

        expect(phases(analysis.gestures)).toEqual([
            `${GestureType.MouthOpen}:end`,
        ]);
        expect(analysis.blendshapes).toBeNull();
        // El cursor sigue a la cabeza.
        expect(analysis.headPose).not.toBeNull();
    });

    test('la calibración termina con la línea base de la cara relajada', () => {
        const current = session();
        let outcome = null;

        current.startCalibration();

        for (let i = 0; i < CALIBRATION_FRAME_COUNT; i++) {
            outcome = current.analyse(
                face({ jawOpen: 0.1 }),
                i * 33,
            ).calibration;
        }

        expect(outcome).toMatchObject({ status: 'done' });
        expect(current.currentBaseline?.blendshapes.jawOpen).toBeCloseTo(0.1);

        // Ya calibrada, vuelve a clasificar.
        expect(current.analyse(face(), 2000).calibration).toBeNull();
    });

    test('una calibración que no ve la cara falla y conserva la línea base anterior', () => {
        const current = session();
        let outcome = null;

        current.startCalibration();

        for (let t = 0; t <= CALIBRATION_TIMEOUT_MS + 100; t += 100) {
            outcome = current.analyse(NO_FACE, t).calibration ?? outcome;
        }

        expect(outcome).toEqual({ status: 'failed', reason: 'no_face' });
        expect(current.currentBaseline).toBeNull();
    });

    test('pausar olvida los gestos activos', () => {
        const current = session();

        current.analyse(face(MOUTH_OPEN), 0);
        current.pause();

        expect(current.isPaused).toBe(true);

        current.resume();

        // El gesto empieza de nuevo: no seguía "pulsado".
        expect(phases(current.analyse(face(MOUTH_OPEN), 500).gestures)).toEqual(
            [`${GestureType.MouthOpen}:start`],
        );
    });

    test('una sesión nueva empieza limpia: sin gestos activos ni línea base', () => {
        const first = session();

        first.startCalibration();
        for (let i = 0; i < CALIBRATION_FRAME_COUNT; i++) {
            first.analyse(face({ jawOpen: 0.1 }), i * 33);
        }
        first.analyse(face(MOUTH_OPEN), 2000);

        const second = new DetectionSession(2, {
            sensitivity: 5,
            enableBlendshapes: false,
        });

        expect(second.id).toBe(2);
        expect(second.currentBaseline).toBeNull();
        expect(second.analyse(NO_FACE, 3000).gestures).toEqual([]);
        expect(
            second.analyse(NO_FACE, 3000 + FACE_LOST_RELEASE_MS).gestures,
        ).toEqual([]);
    });

    test('mide la separación de los labios con los puntos de la cara', () => {
        const analysis = session(true).analyse(
            face({}, faceWithLipGap(0.03)),
            0,
            { width: 320, height: 240 },
        );

        expect(analysis.blendshapes?.[LIPS_APART_KEY]).toBeCloseTo(0.3, 5);
    });

    test('los labios separados abren la boca aunque la mandíbula no baje', () => {
        const analysis = session().analyse(
            face({ jawOpen: 0 }, faceWithLipGap(0.05)),
            0,
        );

        expect(phases(analysis.gestures)).toEqual([
            `${GestureType.MouthOpen}:start`,
        ]);
    });

    test('con los labios apenas juntos no cuenta', () => {
        const analysis = session().analyse(
            face({ jawOpen: 0 }, faceWithLipGap(0.01)),
            0,
        );

        expect(analysis.gestures).toEqual([]);
    });

    test('una sonrisa enseñando los dientes no es abrir la boca', () => {
        const analysis = session().analyse(
            face(
                { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 },
                faceWithLipGap(0.05),
            ),
            0,
        );

        expect(phases(analysis.gestures)).toEqual([
            `${GestureType.Smile}:start`,
        ]);
    });

    test('una "o" al hablar (morritos con los labios separados) no es abrir la boca', () => {
        const analysis = session().analyse(
            face({ mouthPucker: 0.7 }, faceWithLipGap(0.05)),
            0,
        );

        expect(
            analysis.gestures.some(
                (event) => event.gesture === GestureType.MouthOpen,
            ),
        ).toBe(false);
    });
});
