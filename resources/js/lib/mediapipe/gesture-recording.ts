/**
 * Grabación guiada de la señal del motor de gestos (Vision Lab).
 *
 * Sirve para ajustar el clasificador con datos reales: el usuario sigue un
 * guion de pasos ("abre la boca mirando arriba a la derecha"…) y se graba,
 * por fotograma, la pose de la cabeza, los blendshapes y los gestos
 * detectados, etiquetados con el paso. Así se ve qué gesto se dispara cuando
 * no debe (y cuándo no se dispara el que debe) y las grabaciones sirven de
 * tests de regresión.
 *
 * Solo números: ni imágenes ni nada que identifique a la persona. Nunca sale
 * del navegador salvo que el usuario descargue el fichero.
 *
 * Sin DOM ni React.
 */

import { GestureType } from './types';
import type {
    AnalyzedFrame,
    CalibrationState,
    EngineInfo,
    NeutralBaseline,
} from './types';

export type RecordingStep = {
    id: string;
    /** Qué tiene que hacer la persona durante el paso. */
    instruction: string;
    durationMs: number;
    /** Gestos que deberían detectarse en este paso (vacío: ninguno). */
    expected: GestureType[];
};

/** Pausa antes de cada paso para leer la instrucción y colocarse. */
export const RECORDING_PREPARE_MS = 2000;

const GESTURE_STEP_MS = 7000;

export const RECORDING_SCRIPT: RecordingStep[] = [
    {
        id: 'neutral',
        instruction: 'Mira al frente con la cara relajada.',
        durationMs: 5000,
        expected: [],
    },
    {
        id: 'look_around',
        instruction:
            'Sin hacer ningún gesto, mira despacio arriba, abajo, a la izquierda, a la derecha y a las cuatro esquinas de la pantalla.',
        durationMs: 14000,
        expected: [],
    },
    {
        id: 'mouth_front',
        instruction: 'Mirando al frente, abre y cierra la boca 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.MouthOpen],
    },
    {
        id: 'lips_apart',
        instruction:
            'Mirando al frente, separa un poco los labios (sin abrir la boca del todo) y júntalos, 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.MouthOpen],
    },
    {
        id: 'brows_front',
        instruction: 'Mirando al frente, levanta las cejas 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.BrowRaise],
    },
    {
        id: 'mouth_up_right',
        instruction:
            'Mira arriba a la derecha y abre y cierra la boca 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.MouthOpen],
    },
    {
        id: 'mouth_down_right',
        instruction: 'Mira abajo a la derecha y abre y cierra la boca 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.MouthOpen],
    },
    {
        id: 'mouth_up_left',
        instruction:
            'Mira arriba a la izquierda y abre y cierra la boca 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.MouthOpen],
    },
    {
        id: 'brows_up',
        instruction: 'Mira hacia arriba y levanta las cejas 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.BrowRaise],
    },
    {
        id: 'smile',
        instruction: 'Mirando al frente, sonríe 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.Smile],
    },
    {
        id: 'smile_teeth',
        instruction: 'Sonríe enseñando los dientes 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.Smile],
    },
    {
        id: 'blink_left',
        instruction: 'Guiña el ojo izquierdo 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.BlinkLeft],
    },
    {
        id: 'blink_right',
        instruction: 'Guiña el ojo derecho 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.BlinkRight],
    },
    {
        id: 'blink_natural',
        instruction:
            'Parpadea con normalidad, con los dos ojos, como haces siempre.',
        durationMs: GESTURE_STEP_MS,
        expected: [],
    },
    {
        id: 'frown',
        instruction: 'Frunce el ceño 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.BrowFrown],
    },
    {
        id: 'pucker',
        instruction: 'Pon morritos (labios hacia delante) 4 veces.',
        durationMs: GESTURE_STEP_MS,
        expected: [GestureType.MouthPucker],
    },
    {
        id: 'talk',
        instruction:
            'Habla en voz alta unos segundos, como si comentaras la partida.',
        durationMs: 10000,
        expected: [],
    },
    {
        id: 'neutral_end',
        instruction: 'Vuelve a mirar al frente con la cara relajada.',
        durationMs: 5000,
        expected: [],
    },
];

export type RecordingPhase = 'prepare' | 'record';

export type RecorderProgress =
    | {
          finished: false;
          index: number;
          step: RecordingStep;
          phase: RecordingPhase;
          /** Lo que queda de la fase actual. */
          remainingMs: number;
          /** Avance total de la grabación, de 0 a 1. */
          overall: number;
      }
    | { finished: true };

export type RecordedFrame = {
    /** ms desde el inicio de la grabación. */
    t: number;
    step: string;
    phase: RecordingPhase;
    /** [yaw, pitch, roll] normalizados, o null sin cara. */
    pose: [number, number, number] | null;
    /** Valores en el orden de `GestureRecording.blendshapeKeys`, o null. */
    bs: number[] | null;
    /** Eventos del fotograma, como `MOUTH_OPEN:start`. */
    g: string[];
};

export type RecordingMeta = {
    info: EngineInfo | null;
    sensitivity: number;
    baseline: NeutralBaseline | null;
    calibration: CalibrationState;
};

export type GestureRecording = {
    format: 'vout-gesture-recording';
    version: 1;
    recordedAt: string;
    meta: RecordingMeta;
    steps: RecordingStep[];
    prepareMs: number;
    blendshapeKeys: string[];
    frames: RecordedFrame[];
};

export class GestureRecorder {
    private readonly script: RecordingStep[];
    private readonly prepareMs: number;
    private readonly totalMs: number;

    private startedAt: number | null = null;
    private keys: string[] = [];
    private readonly frames: RecordedFrame[] = [];

    constructor(
        script: RecordingStep[] = RECORDING_SCRIPT,
        prepareMs: number = RECORDING_PREPARE_MS,
    ) {
        this.script = script;
        this.prepareMs = prepareMs;
        this.totalMs = script.reduce(
            (sum, step) => sum + prepareMs + step.durationMs,
            0,
        );
    }

    start(now: number): void {
        this.startedAt = now;
    }

    get isRecording(): boolean {
        return this.startedAt !== null;
    }

    get frameCount(): number {
        return this.frames.length;
    }

    progress(now: number): RecorderProgress {
        if (this.startedAt === null) {
            return { finished: true };
        }

        let elapsed = now - this.startedAt;

        if (elapsed >= this.totalMs) {
            return { finished: true };
        }

        const overall = elapsed / this.totalMs;

        for (const [index, step] of this.script.entries()) {
            if (elapsed < this.prepareMs) {
                return {
                    finished: false,
                    index,
                    step,
                    phase: 'prepare',
                    remainingMs: this.prepareMs - elapsed,
                    overall,
                };
            }

            elapsed -= this.prepareMs;

            if (elapsed < step.durationMs) {
                return {
                    finished: false,
                    index,
                    step,
                    phase: 'record',
                    remainingMs: step.durationMs - elapsed,
                    overall,
                };
            }

            elapsed -= step.durationMs;
        }

        return { finished: true };
    }

    /** Graba un fotograma analizado, etiquetado con el paso en curso. */
    addFrame(frame: AnalyzedFrame): void {
        if (this.startedAt === null) {
            return;
        }

        const progress = this.progress(frame.timestamp);

        if (progress.finished) {
            return;
        }

        if (this.keys.length === 0 && frame.blendshapes !== null) {
            this.keys = Object.keys(frame.blendshapes).sort();
        }

        const blendshapes = frame.blendshapes;

        this.frames.push({
            t: round(frame.timestamp - this.startedAt, 1),
            step: progress.step.id,
            phase: progress.phase,
            pose:
                frame.headPose === null
                    ? null
                    : [
                          round(frame.headPose.yaw, 4),
                          round(frame.headPose.pitch, 4),
                          round(frame.headPose.roll, 4),
                      ],
            bs:
                blendshapes === null
                    ? null
                    : this.keys.map((key) => round(blendshapes[key] ?? 0, 4)),
            g: frame.gestures.map((event) => `${event.gesture}:${event.phase}`),
        });
    }

    toJSON(
        meta: RecordingMeta,
        recordedAt: Date = new Date(),
    ): GestureRecording {
        return {
            format: 'vout-gesture-recording',
            version: 1,
            recordedAt: recordedAt.toISOString(),
            meta,
            steps: this.script,
            prepareMs: this.prepareMs,
            blendshapeKeys: this.keys,
            frames: this.frames,
        };
    }
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;

    return Math.round(value * factor) / factor;
}
