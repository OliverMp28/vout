import { beforeEach, describe, expect, test } from 'bun:test';

import {
    GESTURE_DEBOUNCE_MS,
    GESTURE_RELEASE_MS,
    GESTURE_RELEASE_RATIO,
    GESTURE_RISE_FLOOR_RATIO,
    sensitivityToThreshold,
} from '@/lib/mediapipe/constants';
import {
    classifyGestures,
    drainGestureRiseSamples,
    releaseActiveGestures,
    resetGestureTracking,
} from '@/lib/mediapipe/gesture-classifier';
import { GestureType } from '@/lib/mediapipe/types';
import type { NeutralBaseline } from '@/lib/mediapipe/types';

/*
 * Tests de caracterización: fijan el comportamiento del clasificador para
 * que los cambios de rendimiento del motor no alteren cuándo se detecta un
 * gesto.
 */

const SENSITIVITY = 5;
const THRESHOLD = sensitivityToThreshold(SENSITIVITY);

function classify(blendshapes: Record<string, number>, timestamp: number) {
    return classifyGestures(blendshapes, SENSITIVITY, null, timestamp);
}

beforeEach(() => {
    resetGestureTracking();
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

describe('classifyGestures', () => {
    test('no emite nada por debajo del umbral', () => {
        expect(classify({ jawOpen: THRESHOLD - 0.01 }, 0)).toEqual([]);
    });

    test('emite start en el fotograma en que la señal cruza el umbral', () => {
        const events = classify({ jawOpen: THRESHOLD }, 100);

        expect(events).toEqual([
            {
                gesture: GestureType.MouthOpen,
                confidence: THRESHOLD,
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

        const justAboveRelease = THRESHOLD * GESTURE_RELEASE_RATIO + 0.01;

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

        const end = classify({ jawOpen: 0 }, 100 + GESTURE_RELEASE_MS);

        expect(end).toEqual([
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

    test('con varias claves toma la mayor (cejas)', () => {
        const events = classify(
            { browInnerUp: 0.1, browOuterUpLeft: 0.2, browOuterUpRight: 0.8 },
            0,
        );

        expect(events).toEqual([
            expect.objectContaining({
                gesture: GestureType.BrowRaise,
                confidence: 0.8,
                phase: 'start',
            }),
        ]);
    });

    test('resta la línea base neutral antes de comparar', () => {
        const baseline: NeutralBaseline = {
            capturedAt: 0,
            blendshapes: { jawOpen: 0.3 },
        };

        expect(
            classifyGestures({ jawOpen: 0.7 }, SENSITIVITY, baseline, 0),
        ).toEqual([]);

        const events = classifyGestures(
            { jawOpen: 0.85 },
            SENSITIVITY,
            baseline,
            33,
        );

        expect(events).toHaveLength(1);
        expect(events[0].confidence).toBeCloseTo(0.55);
    });

    test('varios gestos a la vez se clasifican por separado', () => {
        const events = classify({ jawOpen: 0.9, eyeBlinkLeft: 0.9 }, 0);

        expect(events.map((event) => event.gesture).sort()).toEqual(
            [GestureType.BlinkLeft, GestureType.MouthOpen].sort(),
        );
    });
});

describe('releaseActiveGestures', () => {
    test('termina todos los gestos activos con la marca dada', () => {
        classify({ jawOpen: 0.9, eyeBlinkRight: 0.9 }, 0);

        const released = releaseActiveGestures(250);

        expect(released).toHaveLength(2);
        expect(released.every((event) => event.phase === 'end')).toBe(true);
        expect(released.every((event) => event.timestamp === 250)).toBe(true);
        expect(releaseActiveGestures(300)).toEqual([]);
    });
});

describe('resetGestureTracking', () => {
    test('olvida el estado sin emitir end', () => {
        classify({ jawOpen: 0.9 }, 0);
        resetGestureTracking();

        expect(classify({ jawOpen: 0.9 }, 10)).toEqual([
            expect.objectContaining({ phase: 'start' }),
        ]);
    });
});

describe('drainGestureRiseSamples', () => {
    const floor = THRESHOLD * GESTURE_RISE_FLOOR_RATIO;

    test('mide desde que la señal supera el suelo hasta que cruza el umbral', () => {
        classify({ jawOpen: 0 }, 0);
        classify({ jawOpen: floor + 0.01 }, 33);
        classify({ jawOpen: THRESHOLD - 0.05 }, 66);
        classify({ jawOpen: THRESHOLD }, 99);

        expect(drainGestureRiseSamples()).toEqual([66]);
        expect(drainGestureRiseSamples()).toEqual([]);
    });

    test('es 0 si cruza el umbral de un fotograma a otro', () => {
        classify({ jawOpen: 0 }, 0);
        classify({ jawOpen: 0.9 }, 33);

        expect(drainGestureRiseSamples()).toEqual([0]);
    });

    test('si la señal vuelve a caer bajo el suelo, la subida empieza de nuevo', () => {
        classify({ jawOpen: floor + 0.01 }, 0);
        classify({ jawOpen: 0 }, 33);
        classify({ jawOpen: floor + 0.01 }, 200);
        classify({ jawOpen: 0.9 }, 233);

        expect(drainGestureRiseSamples()).toEqual([33]);
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

    test('resetGestureTracking descarta las muestras pendientes', () => {
        classify({ jawOpen: 0.9 }, 0);
        resetGestureTracking();

        expect(drainGestureRiseSamples()).toEqual([]);
    });
});
