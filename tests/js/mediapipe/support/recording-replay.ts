/**
 * Reproduce una grabación guiada de Vision Lab (`gesture-recording.ts`) a
 * través del motor de gestos real, sin MediaPipe: calibración automática con
 * los primeros fotogramas de cara neutra y clasificación de todos los demás,
 * como hace el worker.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GestureClassifier } from '@/lib/mediapipe/gesture-classifier';
import type { GestureRecording } from '@/lib/mediapipe/gesture-recording';
import { NeutralCalibration } from '@/lib/mediapipe/neutral-calibration';
import type {
    GestureType,
    HeadPose,
    NeutralBaseline,
} from '@/lib/mediapipe/types';

export const RECORDINGS_DIR = join(
    import.meta.dir,
    '..',
    '..',
    'fixtures',
    'gesture-recordings',
);

export function loadRecordings(): {
    name: string;
    recording: GestureRecording;
}[] {
    return readdirSync(RECORDINGS_DIR)
        .filter((file) => file.endsWith('.json'))
        .sort()
        .map((file) => ({
            name: file.replace(/\.json$/, ''),
            recording: JSON.parse(
                readFileSync(join(RECORDINGS_DIR, file), 'utf8'),
            ) as GestureRecording,
        }));
}

type DecodedFrame = {
    t: number;
    step: string;
    phase: 'prepare' | 'record';
    blendshapes: Record<string, number> | null;
    headPose: HeadPose | null;
};

function decode(recording: GestureRecording): DecodedFrame[] {
    return recording.frames.map((frame) => ({
        t: frame.t,
        step: frame.step,
        phase: frame.phase,
        blendshapes:
            frame.bs === null
                ? null
                : Object.fromEntries(
                      recording.blendshapeKeys.map((key, index) => [
                          key,
                          frame.bs![index],
                      ]),
                  ),
        headPose:
            frame.pose === null
                ? null
                : {
                      yaw: frame.pose[0],
                      pitch: frame.pose[1],
                      roll: frame.pose[2],
                      timestamp: frame.t,
                  },
    }));
}

/**
 * Calibra con los fotogramas del paso `neutral` (cara relajada de frente),
 * como la calibración automática al arrancar el motor.
 */
export function calibrateFromRecording(
    recording: GestureRecording,
): NeutralBaseline {
    const calibration = new NeutralCalibration();

    for (const frame of decode(recording)) {
        if (frame.step !== 'neutral' || frame.phase !== 'record') {
            continue;
        }

        const progress = calibration.addFrame({
            timestamp: frame.t,
            blendshapes: frame.blendshapes,
            headPose: frame.headPose,
        });

        if (progress.status === 'done') {
            return progress.baseline;
        }

        if (progress.status === 'failed') {
            throw new Error(`La calibración falló: ${progress.reason}`);
        }
    }

    throw new Error('El paso neutral no tiene fotogramas suficientes');
}

/** Inicios de gesto por paso de la grabación (solo durante `record`). */
export type StepStarts = Record<string, Partial<Record<GestureType, number>>>;

export function replay(
    recording: GestureRecording,
    baseline: NeutralBaseline,
    sensitivity: number = recording.meta.sensitivity,
): StepStarts {
    const classifier = new GestureClassifier();
    const starts: StepStarts = {};

    for (const step of recording.steps) {
        starts[step.id] = {};
    }

    for (const frame of decode(recording)) {
        if (frame.blendshapes === null) {
            continue;
        }

        const events = classifier.classify(
            {
                blendshapes: frame.blendshapes,
                headPose: frame.headPose,
                timestamp: frame.t,
            },
            sensitivity,
            baseline,
        );

        if (frame.phase !== 'record') {
            continue;
        }

        for (const event of events) {
            if (event.phase === 'start') {
                const step = starts[frame.step];
                step[event.gesture] = (step[event.gesture] ?? 0) + 1;
            }
        }
    }

    return starts;
}
