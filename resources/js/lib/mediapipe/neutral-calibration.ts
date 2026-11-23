/**
 * Calibración de la cara neutra: la línea base que el clasificador resta a
 * cada blendshape (`GestureClassifier`).
 *
 * Solo valen los fotogramas con la cara de frente y relajada. Una línea base
 * tomada mirando a un lado, o sonriendo, desplaza todos los umbrales: es lo
 * que hacía que, tras "Centrar cursor" (que antes también calibraba), un
 * gesto disparase otro.
 *
 * También guarda la postura media de la cabeza: es el "frente" del usuario,
 * desde el que se miden las tolerancias de postura de cada gesto.
 *
 * Si en `timeoutMs` no se reúnen bastantes fotogramas válidos, falla con el
 * motivo más frecuente para que la interfaz pueda explicarlo.
 *
 * Worker-safe: sin DOM ni React.
 */

import {
    CALIBRATION_FRAME_COUNT,
    CALIBRATION_MAX_HEAD_ROTATION,
    CALIBRATION_RELAXED_MAX,
    CALIBRATION_TIMEOUT_MS,
} from './constants';
import { USED_BLENDSHAPE_KEYS } from './gesture-rules';
import type {
    CalibrationFailureReason,
    HeadPose,
    NeutralBaseline,
    NeutralPose,
} from './types';

/** Por qué un fotograma no vale para la línea base. */
type CalibrationRejection = Exclude<CalibrationFailureReason, 'timeout'>;

/** Lo que aporta un fotograma a la calibración. Sin cara, `blendshapes` es null. */
export type CalibrationFrame = {
    timestamp: number;
    blendshapes: Record<string, number> | null;
    headPose: HeadPose | null;
};

export type CalibrationProgress =
    | { status: 'collecting' }
    | { status: 'done'; baseline: NeutralBaseline }
    | { status: 'failed'; reason: CalibrationFailureReason };

export type NeutralCalibrationOptions = {
    frameCount: number;
    timeoutMs: number;
    maxHeadRotation: number;
    relaxedMax: number;
};

const DEFAULT_OPTIONS: NeutralCalibrationOptions = {
    frameCount: CALIBRATION_FRAME_COUNT,
    timeoutMs: CALIBRATION_TIMEOUT_MS,
    maxHeadRotation: CALIBRATION_MAX_HEAD_ROTATION,
    relaxedMax: CALIBRATION_RELAXED_MAX,
};

export class NeutralCalibration {
    private readonly options: NeutralCalibrationOptions;
    private readonly samples: Record<string, number>[] = [];
    private readonly poses: HeadPose[] = [];
    private readonly rejections: Record<CalibrationRejection, number> = {
        no_face: 0,
        not_frontal: 0,
        not_relaxed: 0,
    };
    private startedAt: number | null = null;

    constructor(options: Partial<NeutralCalibrationOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    addFrame(frame: CalibrationFrame): CalibrationProgress {
        this.startedAt ??= frame.timestamp;

        const rejection = this.rejectionOf(frame);

        if (rejection === null && frame.blendshapes !== null) {
            this.samples.push(frame.blendshapes);

            if (frame.headPose !== null) {
                this.poses.push(frame.headPose);
            }
        } else if (rejection !== null) {
            this.rejections[rejection]++;
        }

        if (this.samples.length >= this.options.frameCount) {
            return { status: 'done', baseline: this.average() };
        }

        if (frame.timestamp - this.startedAt >= this.options.timeoutMs) {
            return { status: 'failed', reason: this.mainRejection() };
        }

        return { status: 'collecting' };
    }

    /** Por qué un fotograma no vale, o null si vale. */
    private rejectionOf(frame: CalibrationFrame): CalibrationRejection | null {
        if (frame.blendshapes === null) {
            return 'no_face';
        }

        const pose = frame.headPose;
        const limit = this.options.maxHeadRotation;

        // `pitch` es el giro lateral y `roll` el cabeceo (ver head-tracker.ts).
        if (
            pose !== null &&
            (Math.abs(pose.pitch) > limit || Math.abs(pose.roll) > limit)
        ) {
            return 'not_frontal';
        }

        for (const key of USED_BLENDSHAPE_KEYS) {
            if ((frame.blendshapes[key] ?? 0) > this.options.relaxedMax) {
                return 'not_relaxed';
            }
        }

        return null;
    }

    private average(): NeutralBaseline {
        const sums: Record<string, number> = {};

        for (const sample of this.samples) {
            for (const [key, value] of Object.entries(sample)) {
                sums[key] = (sums[key] ?? 0) + value;
            }
        }

        const blendshapes: Record<string, number> = {};

        for (const [key, sum] of Object.entries(sums)) {
            blendshapes[key] = sum / this.samples.length;
        }

        const headPose = this.averagePose();

        return headPose === null
            ? { capturedAt: Date.now(), blendshapes }
            : { capturedAt: Date.now(), blendshapes, headPose };
    }

    /** Postura media de los fotogramas válidos, o null si no hubo ninguna. */
    private averagePose(): NeutralPose | null {
        if (this.poses.length === 0) {
            return null;
        }

        let pitch = 0;
        let roll = 0;

        for (const pose of this.poses) {
            pitch += pose.pitch;
            roll += pose.roll;
        }

        return {
            pitch: pitch / this.poses.length,
            roll: roll / this.poses.length,
        };
    }

    /**
     * El motivo de rechazo más frecuente. `timeout` si no hubo rechazos: los
     * fotogramas valían pero llegaron demasiado pocos (cámara muy lenta).
     */
    private mainRejection(): CalibrationFailureReason {
        let reason: CalibrationFailureReason = 'timeout';
        let count = 0;

        for (const [rejection, times] of Object.entries(this.rejections)) {
            if (times > count) {
                reason = rejection as CalibrationRejection;
                count = times;
            }
        }

        return reason;
    }
}
