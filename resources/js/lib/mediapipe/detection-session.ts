/**
 * Una sesión de detección: lo que dura una activación del control facial.
 *
 * El worker carga MediaPipe una vez y puede servir varias sesiones seguidas
 * (`engine-runtime.ts`). Todo lo que depende de quién está delante y de cómo
 * lo configuró vive aquí y nace limpio en cada sesión: el clasificador (con
 * sus gestos activos), la calibración en curso, la línea base de la cara
 * neutra, la cara perdida y la pausa. Así reactivar el control facial empieza
 * de cero sin recargar el modelo.
 *
 * Sin dependencias del worker ni de MediaPipe: recibe el resultado de
 * `detectForVideo` y se prueba con resultados falsos.
 */

import { FACE_LOST_RELEASE_MS } from './constants';
import { LIPS_APART_KEY, measureLipsApart } from './face-measures';
import type { FacePoint, ImageSize } from './face-measures';
import { GestureClassifier } from './gesture-classifier';
import { USED_BLENDSHAPE_KEYS } from './gesture-rules';
import { extractHeadPose } from './head-pose';
import { NeutralCalibration } from './neutral-calibration';
import type {
    CalibrationFailureReason,
    GestureEvent,
    HeadPose,
    NeutralBaseline,
    WorkerConfig,
} from './types';

/** Lo que la sesión usa del resultado de `FaceLandmarker.detectForVideo`. */
export type LandmarkerResultLike = {
    faceLandmarks?: FacePoint[][];
    faceBlendshapes?: {
        categories: { categoryName: string; score: number }[];
    }[];
    facialTransformationMatrixes?: { data: ArrayLike<number> }[];
};

/** Cómo terminó la calibración que estaba en curso. */
export type CalibrationOutcome =
    | { status: 'done'; baseline: NeutralBaseline }
    | { status: 'failed'; reason: CalibrationFailureReason };

/** Tamaño por defecto de la imagen analizada (la de captura, 4:3). */
const DEFAULT_IMAGE: ImageSize = { width: 320, height: 240 };

export type FrameAnalysis = {
    gestures: GestureEvent[];
    headPose: HeadPose | null;
    /** Los 52 blendshapes, solo con `enableBlendshapes` y fuera de calibración. */
    blendshapes: Record<string, number> | null;
    /** Solo en el fotograma en que termina una calibración. */
    calibration: CalibrationOutcome | null;
};

/**
 * Convierte las categorías de MediaPipe en un diccionario `{nombre: score}`.
 *
 * @param includeAll Si `true`, las 52 categorías (Vision Lab). Si no, solo las
 *                   que consume el clasificador (`USED_BLENDSHAPE_KEYS`).
 */
export function blendshapeMapFromResult(
    blendshapes: { categories: { categoryName: string; score: number }[] }[],
    includeAll: boolean,
): Record<string, number> {
    const map: Record<string, number> = {};

    if (blendshapes.length === 0) {
        return map;
    }

    for (const category of blendshapes[0].categories) {
        if (includeAll || USED_BLENDSHAPE_KEYS.has(category.categoryName)) {
            map[category.categoryName] = category.score;
        }
    }

    return map;
}

export class DetectionSession {
    readonly id: number;

    private config: WorkerConfig;
    private readonly classifier = new GestureClassifier();
    private baseline: NeutralBaseline | null = null;
    /** Calibración en curso, o null. */
    private calibration: NeutralCalibration | null = null;
    /** Marca del primer fotograma seguido sin cara, o null si se ve la cara. */
    private faceLostSince: number | null = null;
    private paused = false;

    constructor(id: number, config: WorkerConfig) {
        this.id = id;
        this.config = { ...config };
    }

    get isPaused(): boolean {
        return this.paused;
    }

    get currentBaseline(): NeutralBaseline | null {
        return this.baseline;
    }

    updateConfig(config: Partial<WorkerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Empieza a tomar la cara neutra. Los gestos activos se terminan en el
     * siguiente fotograma: mientras se calibra no se clasifica.
     */
    startCalibration(): void {
        this.calibration = new NeutralCalibration();
    }

    /** Los gestos activos se olvidan: al reanudar no siguen "pulsados". */
    pause(): void {
        this.paused = true;
        this.classifier.reset();
        this.faceLostSince = null;
    }

    resume(): void {
        this.paused = false;
    }

    /** Ver `GestureClassifier.drainRiseSamples`. */
    drainRiseSamples(): number[] {
        return this.classifier.drainRiseSamples();
    }

    /**
     * Gestos, pose y blendshapes de un fotograma analizado.
     *
     * @param image Tamaño de la imagen analizada (para las medidas con puntos).
     */
    analyse(
        result: LandmarkerResultLike,
        timestamp: number,
        image: ImageSize = DEFAULT_IMAGE,
    ): FrameAnalysis {
        const points = result.faceLandmarks?.[0];
        const hasFace = points !== undefined;

        // En Vision Lab, los 52 blendshapes; en juego, solo los que usa el
        // clasificador (Sesión 3.4 §4.2). Más las medidas con puntos.
        const blendshapes = hasFace
            ? blendshapeMapFromResult(
                  result.faceBlendshapes ?? [],
                  this.config.enableBlendshapes,
              )
            : null;

        if (blendshapes !== null && points !== undefined) {
            const lipsApart = measureLipsApart(points, image);

            if (lipsApart !== null) {
                blendshapes[LIPS_APART_KEY] = lipsApart;
            }
        }

        const matrix = hasFace
            ? result.facialTransformationMatrixes?.[0]?.data
            : undefined;
        const headPose =
            matrix === undefined ? null : extractHeadPose(matrix, timestamp);

        // Calibración: no se clasifican gestos (los activos terminan), pero el
        // cursor sigue a la cabeza.
        if (this.calibration !== null) {
            return {
                calibration: this.calibrate(timestamp, blendshapes, headPose),
                gestures: this.classifier.releaseAll(timestamp),
                headPose,
                blendshapes: null,
            };
        }

        // Sin cara. Si lleva `FACE_LOST_RELEASE_MS` sin verse, los gestos
        // activos se dan por terminados: un gesto sostenido no debe quedarse
        // "pulsado".
        if (blendshapes === null) {
            this.faceLostSince ??= timestamp;

            return {
                calibration: null,
                gestures:
                    timestamp - this.faceLostSince >= FACE_LOST_RELEASE_MS
                        ? this.classifier.releaseAll(this.faceLostSince)
                        : [],
                headPose: null,
                blendshapes: null,
            };
        }

        this.faceLostSince = null;

        // Con la cabeza girada, cada gesto deja de fiarse de su señal a partir
        // de su propia tolerancia (`gesture-rules.ts`); el head tracking sigue.
        return {
            calibration: null,
            gestures: this.classifier.classify(
                { blendshapes, headPose, timestamp },
                this.config.sensitivity,
                this.baseline,
            ),
            headPose,
            blendshapes: this.config.enableBlendshapes ? blendshapes : null,
        };
    }

    /** Añade un fotograma a la calibración en curso y dice si terminó. */
    private calibrate(
        timestamp: number,
        blendshapes: Record<string, number> | null,
        headPose: HeadPose | null,
    ): CalibrationOutcome | null {
        const progress = this.calibration?.addFrame({
            timestamp,
            blendshapes,
            headPose,
        });

        if (progress === undefined || progress.status === 'collecting') {
            return null;
        }

        this.calibration = null;

        if (progress.status === 'done') {
            this.baseline = progress.baseline;

            return { status: 'done', baseline: progress.baseline };
        }

        // Si falla, se mantiene la línea base anterior (o ninguna).
        return { status: 'failed', reason: progress.reason };
    }
}
