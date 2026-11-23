import { beforeEach, describe, expect, test } from 'bun:test';

import {
    GESTURE_DEBOUNCE_MS,
    GESTURE_RELEASE_MS,
    GESTURE_RELEASE_RATIO,
    GESTURE_RISE_FLOOR_RATIO,
    sensitivityToThreshold,
} from '@/lib/mediapipe/constants';
import {
    GestureClassifier,
    activationThreshold,
} from '@/lib/mediapipe/gesture-classifier';
import {
    GESTURE_RULES,
    PUCKER_MAX_JAW_OPEN,
    USED_BLENDSHAPE_KEYS,
    WINK_MIN_ASYMMETRY,
    isPoseWithinTolerance,
} from '@/lib/mediapipe/gesture-rules';
import { GestureType } from '@/lib/mediapipe/types';
import type { HeadPose, NeutralBaseline } from '@/lib/mediapipe/types';

/*
 * La máquina de estados (start/hold/end, histéresis, subida) se fija con la
 * boca, el gesto de una sola clave; las reglas de cada gesto, con casos
 * sacados de las grabaciones reales (`gesture-recordings.test.ts`).
 */

const SENSITIVITY = 5;
const MOUTH = activationThreshold(GestureType.MouthOpen, SENSITIVITY);

let classifier: GestureClassifier;

function pose(pitch: number, roll: number): HeadPose {
    return { yaw: 0, pitch, roll, timestamp: 0 };
}

function classify(
    blendshapes: Record<string, number>,
    timestamp: number,
    options: { headPose?: HeadPose | null; baseline?: NeutralBaseline } = {},
) {
    return classifier.classify(
        { blendshapes, headPose: options.headPose ?? null, timestamp },
        SENSITIVITY,
        options.baseline ?? null,
    );
}

function started(
    blendshapes: Record<string, number>,
    options: { headPose?: HeadPose | null; baseline?: NeutralBaseline } = {},
): GestureType[] {
    return classify(blendshapes, 0, options)
        .filter((event) => event.phase === 'start')
        .map((event) => event.gesture)
        .sort();
}

beforeEach(() => {
    classifier = new GestureClassifier();
});

describe('sensitivityToThreshold', () => {
    test('convierte la sensibilidad de 1-10 en un umbral de 0.85 a 0.10', () => {
        expect(sensitivityToThreshold(1)).toBeCloseTo(0.85);
        expect(sensitivityToThreshold(10)).toBeCloseTo(0.1);
        expect(sensitivityToThreshold(5)).toBeCloseTo(0.5167, 3);
    });

    test('recorta valores fuera de rango', () => {
        expect(sensitivityToThreshold(-3)).toBeCloseTo(0.85);
        expect(sensitivityToThreshold(42)).toBeCloseTo(0.1);
    });
});

describe('activationThreshold', () => {
    test('ajusta el umbral de la sensibilidad al recorrido de cada gesto', () => {
        const base = sensitivityToThreshold(SENSITIVITY);

        expect(activationThreshold(GestureType.BrowRaise, SENSITIVITY)).toBe(
            base,
        );
        expect(MOUTH).toBeCloseTo(
            base * GESTURE_RULES[GestureType.MouthOpen].thresholdScale,
        );
        expect(MOUTH).toBeLessThan(base);
    });
});

describe('máquina de estados', () => {
    test('no emite nada por debajo del umbral', () => {
        expect(classify({ jawOpen: MOUTH - 0.01 }, 0)).toEqual([]);
    });

    test('emite start en el fotograma en que la señal cruza el umbral', () => {
        expect(classify({ jawOpen: MOUTH }, 100)).toEqual([
            {
                gesture: GestureType.MouthOpen,
                confidence: MOUTH,
                timestamp: 100,
                phase: 'start',
            },
        ]);
    });

    test('mientras sigue activo emite hold cada GESTURE_DEBOUNCE_MS', () => {
        classify({ jawOpen: 0.9 }, 0);

        expect(classify({ jawOpen: 0.9 }, GESTURE_DEBOUNCE_MS - 1)).toEqual([]);

        const hold = classify({ jawOpen: 0.9 }, GESTURE_DEBOUNCE_MS);

        expect(hold).toHaveLength(1);
        expect(hold[0].phase).toBe('hold');
        expect(classify({ jawOpen: 0.9 }, GESTURE_DEBOUNCE_MS + 10)).toEqual(
            [],
        );
    });

    test('la histéresis mantiene el gesto entre el umbral de suelta y el de activación', () => {
        classify({ jawOpen: 0.9 }, 0);

        const justAboveRelease = MOUTH * GESTURE_RELEASE_RATIO + 0.01;

        expect(classify({ jawOpen: justAboveRelease }, 50)).toEqual([]);
        expect(classify({ jawOpen: justAboveRelease }, 500)).toEqual([
            expect.objectContaining({ phase: 'hold' }),
        ]);
    });

    test('emite end cuando la señal lleva GESTURE_RELEASE_MS por debajo del umbral de suelta', () => {
        classify({ jawOpen: 0.9 }, 0);

        expect(classify({ jawOpen: 0 }, 100)).toEqual([]);
        expect(classify({ jawOpen: 0 }, 100 + GESTURE_RELEASE_MS - 1)).toEqual(
            [],
        );
        expect(classify({ jawOpen: 0 }, 100 + GESTURE_RELEASE_MS)).toEqual([
            {
                gesture: GestureType.MouthOpen,
                confidence: 0,
                timestamp: 100,
                phase: 'end',
            },
        ]);
    });

    test('un fotograma suelto por debajo no termina el gesto', () => {
        classify({ jawOpen: 0.9 }, 0);
        classify({ jawOpen: 0 }, 33);

        expect(classify({ jawOpen: 0.9 }, 66)).toEqual([]);
        expect(classify({ jawOpen: 0 }, 99)).toEqual([]);
        expect(classify({ jawOpen: 0 }, 99 + GESTURE_RELEASE_MS)).toEqual([
            expect.objectContaining({ phase: 'end', timestamp: 99 }),
        ]);
    });

    test('resta la línea base de cada blendshape antes de comparar', () => {
        const baseline: NeutralBaseline = {
            capturedAt: 0,
            blendshapes: { jawOpen: 0.3 },
        };

        expect(
            classify({ jawOpen: 0.3 + MOUTH - 0.01 }, 0, { baseline }),
        ).toEqual([]);

        const events = classify({ jawOpen: 0.85 }, 33, { baseline });

        expect(events).toHaveLength(1);
        expect(events[0].confidence).toBeCloseTo(0.55);
    });

    test('varios gestos a la vez se clasifican por separado', () => {
        expect(started({ jawOpen: 0.9, browInnerUp: 0.9 })).toEqual(
            [GestureType.BrowRaise, GestureType.MouthOpen].sort(),
        );
    });

    test('cada clasificador tiene su propio estado', () => {
        classify({ jawOpen: 0.9 }, 0);

        expect(
            new GestureClassifier().classify(
                {
                    blendshapes: { jawOpen: 0.9 },
                    headPose: null,
                    timestamp: 10,
                },
                SENSITIVITY,
                null,
            ),
        ).toEqual([expect.objectContaining({ phase: 'start' })]);
    });
});

describe('combinación de claves', () => {
    test('cejas: basta con una levantada (la mayor)', () => {
        expect(
            classify(
                {
                    browInnerUp: 0.1,
                    browOuterUpLeft: 0.2,
                    browOuterUpRight: 0.8,
                },
                0,
            ),
        ).toEqual([
            expect.objectContaining({
                gesture: GestureType.BrowRaise,
                confidence: 0.8,
                phase: 'start',
            }),
        ]);
    });

    test('ceño: tienen que bajar las dos cejas', () => {
        expect(started({ browDownLeft: 0.9, browDownRight: 0.1 })).toEqual([]);
        expect(started({ browDownLeft: 0.9, browDownRight: 0.8 })).toEqual([
            GestureType.BrowFrown,
        ]);
    });
});

describe('guiños', () => {
    test('un parpadeo con los dos ojos no es un guiño', () => {
        expect(started({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.85 })).toEqual([]);
    });

    test('un ojo bastante más cerrado que el otro es un guiño de ese ojo', () => {
        expect(
            started({
                eyeBlinkLeft: 0.6,
                eyeBlinkRight: 0.6 - WINK_MIN_ASYMMETRY,
            }),
        ).toEqual([GestureType.BlinkLeft]);

        classifier.reset();

        expect(started({ eyeBlinkLeft: 0.2, eyeBlinkRight: 0.6 })).toEqual([
            GestureType.BlinkRight,
        ]);
    });

    test('la asimetría solo se pide para empezar: cerrar el otro ojo no corta el guiño', () => {
        classify({ eyeBlinkLeft: 0.7, eyeBlinkRight: 0.1 }, 0);

        expect(
            classify({ eyeBlinkLeft: 0.7, eyeBlinkRight: 0.7 }, 100),
        ).toEqual([]);
        expect(
            classify(
                { eyeBlinkLeft: 0.7, eyeBlinkRight: 0.7 },
                GESTURE_DEBOUNCE_MS,
            ),
        ).toEqual([
            expect.objectContaining({
                gesture: GestureType.BlinkLeft,
                phase: 'hold',
            }),
        ]);
    });

    test('la ceja que baja al guiñar no cuenta como ceño', () => {
        expect(
            started({
                eyeBlinkLeft: 0.1,
                eyeBlinkRight: 0.7,
                browDownLeft: 0.6,
                browDownRight: 0.7,
            }),
        ).toEqual([GestureType.BlinkRight]);
    });
});

describe('morritos', () => {
    test('con la mandíbula abierta son de estar hablando', () => {
        expect(
            started({ mouthPucker: 0.8, jawOpen: PUCKER_MAX_JAW_OPEN + 0.02 }),
        ).toEqual([]);
    });

    test('con la boca cerrada sí cuentan', () => {
        expect(started({ mouthPucker: 0.8, jawOpen: 0 })).toEqual([
            GestureType.MouthPucker,
        ]);
    });
});

describe('postura de la cabeza', () => {
    const lookingUp = pose(0, -0.4);

    test('mirando arriba las cejas no cuentan, pero la boca sí', () => {
        expect(
            started(
                { browOuterUpLeft: 0.9, jawOpen: 0.6 },
                { headPose: lookingUp },
            ),
        ).toEqual([GestureType.MouthOpen]);
    });

    test('la tolerancia se mide desde la postura neutra de la calibración', () => {
        const baseline: NeutralBaseline = {
            capturedAt: 0,
            blendshapes: {},
            headPose: { pitch: 0, roll: -0.3 },
        };

        // Con esa cámara, -0.4 está casi de frente.
        expect(
            started(
                { browOuterUpLeft: 0.9 },
                { headPose: lookingUp, baseline },
            ),
        ).toEqual([GestureType.BrowRaise]);
    });

    test('un gesto activo termina si la cabeza sale de su tolerancia', () => {
        classify({ browInnerUp: 0.9 }, 0, { headPose: pose(0, 0) });

        expect(
            classify({ browInnerUp: 0.9 }, 33, { headPose: lookingUp }),
        ).toEqual([]);
        expect(
            classify({ browInnerUp: 0.9 }, 33 + GESTURE_RELEASE_MS, {
                headPose: lookingUp,
            }),
        ).toEqual([
            expect.objectContaining({
                gesture: GestureType.BrowRaise,
                phase: 'end',
                timestamp: 33,
            }),
        ]);
    });

    test('con la cabeza girada el ojo lejano no cuenta como guiño', () => {
        expect(
            started(
                { eyeBlinkLeft: 0.6, eyeBlinkRight: 0.3 },
                { headPose: pose(-0.5, 0) },
            ),
        ).toEqual([]);
    });

    test('sin pose de la cabeza no se descarta nada', () => {
        expect(started({ browInnerUp: 0.9 }, { headPose: null })).toEqual([
            GestureType.BrowRaise,
        ]);
    });
});

describe('isPoseWithinTolerance', () => {
    const tolerance = { turn: 0.3, up: 0.2, down: 0.4 };

    test('mide giro, subida y bajada por separado', () => {
        expect(isPoseWithinTolerance(pose(0.3, 0), null, tolerance)).toBe(true);
        expect(isPoseWithinTolerance(pose(-0.31, 0), null, tolerance)).toBe(
            false,
        );
        expect(isPoseWithinTolerance(pose(0, -0.2), null, tolerance)).toBe(
            true,
        );
        expect(isPoseWithinTolerance(pose(0, -0.21), null, tolerance)).toBe(
            false,
        );
        expect(isPoseWithinTolerance(pose(0, 0.4), null, tolerance)).toBe(true);
        expect(isPoseWithinTolerance(pose(0, 0.41), null, tolerance)).toBe(
            false,
        );
    });

    test('desde la postura neutra', () => {
        const neutral = { pitch: 0.1, roll: -0.15 };

        expect(
            isPoseWithinTolerance(pose(0.35, -0.3), neutral, tolerance),
        ).toBe(true);
        expect(isPoseWithinTolerance(pose(0.1, -0.4), neutral, tolerance)).toBe(
            false,
        );
    });
});

describe('USED_BLENDSHAPE_KEYS', () => {
    test('incluye las claves de cada gesto y las que miran sus reglas', () => {
        for (const rule of Object.values(GESTURE_RULES)) {
            for (const key of [...rule.keys, ...(rule.contextKeys ?? [])]) {
                expect(USED_BLENDSHAPE_KEYS.has(key)).toBe(true);
            }
        }
    });
});

describe('releaseAll', () => {
    test('termina todos los gestos activos con la marca dada', () => {
        classify({ jawOpen: 0.9, browInnerUp: 0.9 }, 0);

        const released = classifier.releaseAll(250);

        expect(released).toHaveLength(2);
        expect(released.every((event) => event.phase === 'end')).toBe(true);
        expect(released.every((event) => event.timestamp === 250)).toBe(true);
        expect(classifier.releaseAll(300)).toEqual([]);
    });
});

describe('reset', () => {
    test('olvida el estado sin emitir end', () => {
        classify({ jawOpen: 0.9 }, 0);
        classifier.reset();

        expect(classify({ jawOpen: 0.9 }, 10)).toEqual([
            expect.objectContaining({ phase: 'start' }),
        ]);
    });
});

describe('drainRiseSamples', () => {
    const floor = MOUTH * GESTURE_RISE_FLOOR_RATIO;

    test('mide desde que la señal supera el suelo hasta que cruza el umbral', () => {
        classify({ jawOpen: 0 }, 0);
        classify({ jawOpen: floor + 0.01 }, 33);
        classify({ jawOpen: MOUTH - 0.05 }, 66);
        classify({ jawOpen: MOUTH }, 99);

        expect(classifier.drainRiseSamples()).toEqual([66]);
        expect(classifier.drainRiseSamples()).toEqual([]);
    });

    test('es 0 si cruza el umbral de un fotograma a otro', () => {
        classify({ jawOpen: 0 }, 0);
        classify({ jawOpen: 0.9 }, 33);

        expect(classifier.drainRiseSamples()).toEqual([0]);
    });

    test('si la señal vuelve a caer bajo el suelo, la subida empieza de nuevo', () => {
        classify({ jawOpen: floor + 0.01 }, 0);
        classify({ jawOpen: 0 }, 33);
        classify({ jawOpen: floor + 0.01 }, 200);
        classify({ jawOpen: 0.9 }, 233);

        expect(classifier.drainRiseSamples()).toEqual([33]);
    });

    test('no cambia los eventos emitidos', () => {
        classify({ jawOpen: floor + 0.01 }, 0);

        expect(classify({ jawOpen: 0.9 }, 33)).toEqual([
            {
                gesture: GestureType.MouthOpen,
                confidence: 0.9,
                timestamp: 33,
                phase: 'start',
            },
        ]);
    });

    test('reset descarta las muestras pendientes', () => {
        classify({ jawOpen: 0.9 }, 0);
        classifier.reset();

        expect(classifier.drainRiseSamples()).toEqual([]);
    });
});
