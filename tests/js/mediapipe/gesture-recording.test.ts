import { describe, expect, test } from 'bun:test';

import { GestureRecorder } from '@/lib/mediapipe/gesture-recording';
import type { RecordingStep } from '@/lib/mediapipe/gesture-recording';
import { GestureType } from '@/lib/mediapipe/types';
import type { AnalyzedFrame } from '@/lib/mediapipe/types';

const SCRIPT: RecordingStep[] = [
    { id: 'neutral', instruction: 'Neutral', durationMs: 1000, expected: [] },
    {
        id: 'mouth',
        instruction: 'Abre la boca',
        durationMs: 2000,
        expected: [GestureType.MouthOpen],
    },
];

const META = {
    info: null,
    sensitivity: 5,
    baseline: null,
    calibration: { status: 'idle' as const },
};

function analyzed(
    timestamp: number,
    overrides: Partial<AnalyzedFrame> = {},
): AnalyzedFrame {
    return {
        timestamp,
        headPose: { yaw: 0.01234567, pitch: -0.2, roll: 0.3, timestamp },
        blendshapes: { jawOpen: 0.123456, browInnerUp: 0.2 },
        gestures: [],
        ...overrides,
    };
}

describe('GestureRecorder', () => {
    test('avanza por el guion: preparación y grabación de cada paso', () => {
        const recorder = new GestureRecorder(SCRIPT, 500);

        recorder.start(100);

        expect(recorder.progress(100)).toMatchObject({
            finished: false,
            index: 0,
            phase: 'prepare',
            remainingMs: 500,
        });
        expect(recorder.progress(700)).toMatchObject({
            index: 0,
            phase: 'record',
            remainingMs: 900,
        });
        expect(recorder.progress(1700)).toMatchObject({
            index: 1,
            phase: 'prepare',
        });
        expect(recorder.progress(2200)).toMatchObject({
            index: 1,
            phase: 'record',
        });
        expect(recorder.progress(4100)).toEqual({ finished: true });
    });

    test('sin empezar no graba nada', () => {
        const recorder = new GestureRecorder(SCRIPT, 500);

        recorder.addFrame(analyzed(0));

        expect(recorder.frameCount).toBe(0);
        expect(recorder.progress(0)).toEqual({ finished: true });
    });

    test('etiqueta cada fotograma con su paso y fase y redondea los valores', () => {
        const recorder = new GestureRecorder(SCRIPT, 500);

        recorder.start(0);
        recorder.addFrame(analyzed(100));
        recorder.addFrame(
            analyzed(2100, {
                gestures: [
                    {
                        gesture: GestureType.MouthOpen,
                        confidence: 0.9,
                        timestamp: 2100,
                        phase: 'start',
                    },
                ],
            }),
        );
        recorder.addFrame(
            analyzed(2200, { headPose: null, blendshapes: null }),
        );
        recorder.addFrame(analyzed(9999));

        const recording = recorder.toJSON(
            META,
            new Date('2026-11-21T10:00:00Z'),
        );

        expect(recording).toMatchObject({
            format: 'vout-gesture-recording',
            version: 1,
            recordedAt: '2026-11-21T10:00:00.000Z',
            prepareMs: 500,
            blendshapeKeys: ['browInnerUp', 'jawOpen'],
        });
        expect(recording.frames).toEqual([
            {
                t: 100,
                step: 'neutral',
                phase: 'prepare',
                pose: [0.0123, -0.2, 0.3],
                bs: [0.2, 0.1235],
                g: [],
            },
            {
                t: 2100,
                step: 'mouth',
                phase: 'record',
                pose: [0.0123, -0.2, 0.3],
                bs: [0.2, 0.1235],
                g: ['MOUTH_OPEN:start'],
            },
            {
                t: 2200,
                step: 'mouth',
                phase: 'record',
                pose: null,
                bs: null,
                g: [],
            },
        ]);
    });
});
