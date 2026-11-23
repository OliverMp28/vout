/**
 * Web Worker de detección de gestos.
 *
 * Ejecuta MediaPipe FaceLandmarker fuera del hilo principal para no
 * bloquear el renderizado de los juegos. Protocolo tipado en
 * `lib/mediapipe/types.ts`: por cada `FRAME` responde exactamente una vez,
 * con `RESULT` o `FRAME_DROPPED`, y el hilo principal no envía el siguiente
 * hasta recibir esa respuesta (`frame-pump.ts`). Así nunca hay cola.
 *
 * MediaPipe (bundle, WASM y modelo) lo sirve Vout: el hilo principal manda las
 * URLs en `INIT` (`runtime-assets.ts`). El bundle se importa en tiempo de
 * ejecución desde esa URL, no se empaqueta con el worker: en desarrollo el
 * worker corre desde un Blob URL y los módulos de node_modules transformados
 * por Vite no se resuelven bien desde ahí.
 *
 * @see https://ai.google.dev/mediapipe/solutions/vision/face_landmarker
 */

// Solo tipos: se elimina al compilar.
import type * as Vision from '@mediapipe/tasks-vision';
import type {
    FaceLandmarker as FaceLandmarkerInstance,
    FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

import {
    DEFAULT_DETECTION_CONFIG,
    FACE_LOST_RELEASE_MS,
    MAX_CONSECUTIVE_INFERENCE_ERRORS,
} from '@/lib/mediapipe/constants';
import { GestureClassifier } from '@/lib/mediapipe/gesture-classifier';
import { USED_BLENDSHAPE_KEYS } from '@/lib/mediapipe/gesture-rules';
import { extractHeadPose } from '@/lib/mediapipe/head-pose';
import { NeutralCalibration } from '@/lib/mediapipe/neutral-calibration';
import type {
    EngineInfo,
    GestureEvent,
    HeadPose,
    MediaPipeRuntimeAssets,
    NeutralBaseline,
    PreferredDelegate,
    WasmFilesetUrls,
    WorkerConfig,
    WorkerInMessage,
    WorkerOutMessage,
} from '@/lib/mediapipe/types';

type VisionModule = typeof Vision;

// ---------------------------------------------------------------------------
// Handlers globales — capturan errores que escapan de try/catch
// ---------------------------------------------------------------------------

self.addEventListener('error', (e) => {
    console.error('[GestureWorker] Unhandled error:', e.message, e);
    post({
        type: 'ERROR',
        code: 'UNCAUGHT',
        message: e.message ?? 'Unhandled worker error',
    });
});

self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason =
        e.reason instanceof Error ? e.reason.message : String(e.reason);
    console.error('[GestureWorker] Unhandled rejection:', reason, e.reason);
    post({
        type: 'ERROR',
        code: 'UNCAUGHT',
        message: reason ?? 'Unhandled promise rejection',
    });
});

// ---------------------------------------------------------------------------
// Estado del worker
// ---------------------------------------------------------------------------

let landmarker: FaceLandmarkerInstance | null = null;
let paused = false;
let config: WorkerConfig = {
    sensitivity: 5,
    enableBlendshapes: false,
};
let baseline: NeutralBaseline | null = null;

const classifier = new GestureClassifier();

/** Calibración en curso, o null. */
let calibration: NeutralCalibration | null = null;

/** Timestamp del primer fotograma seguido sin cara, o null si se ve la cara. */
let faceLostSince: number | null = null;

let consecutiveInferenceErrors = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(msg: WorkerOutMessage): void {
    self.postMessage(msg);
}

/**
 * Hora en milisegundos de época con precisión de `performance.now()`. Worker
 * y página tienen orígenes de reloj distintos: así sus marcas se comparan.
 */
function epochNow(): number {
    return performance.timeOrigin + performance.now();
}

/**
 * Convierte las categorías crudas de MediaPipe en un diccionario `{nombre: score}`.
 *
 * @param includeAll Si `true`, las 52 categorías (Vision Lab). Si no, solo las
 *                   que consume el clasificador (`USED_BLENDSHAPE_KEYS`).
 */
function blendshapeMapFromResult(
    blendshapes: { categories: { categoryName: string; score: number }[] }[],
    includeAll: boolean,
): Record<string, number> {
    const map: Record<string, number> = {};
    if (blendshapes.length === 0) return map;

    for (const cat of blendshapes[0].categories) {
        if (includeAll || USED_BLENDSHAPE_KEYS.has(cat.categoryName)) {
            map[cat.categoryName] = cat.score;
        }
    }
    return map;
}

/**
 * Importa el bundle de MediaPipe desde la URL que sirve Vout. `@vite-ignore`
 * evita que Vite intente resolverlo: es una URL en tiempo de ejecución.
 */
async function loadVisionModule(url: string): Promise<VisionModule> {
    const vision = (await import(/* @vite-ignore */ url)) as VisionModule;

    if (!vision.FaceLandmarker || !vision.FilesetResolver) {
        throw new Error(
            'MediaPipe bundle did not export FaceLandmarker or FilesetResolver',
        );
    }

    return vision;
}

function createLandmarker(
    vision: VisionModule,
    fileset: WasmFilesetUrls,
    modelUrl: string,
    delegate: EngineInfo['delegate'],
): Promise<FaceLandmarkerInstance> {
    return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelUrl, delegate },
        runningMode: 'VIDEO',
        numFaces: DEFAULT_DETECTION_CONFIG.numFaces,
        minFaceDetectionConfidence:
            DEFAULT_DETECTION_CONFIG.minFaceDetectionConfidence,
        minFacePresenceConfidence:
            DEFAULT_DETECTION_CONFIG.minFacePresenceConfidence,
        outputFaceBlendshapes: DEFAULT_DETECTION_CONFIG.outputFaceBlendshapes,
        outputFacialTransformationMatrixes:
            DEFAULT_DETECTION_CONFIG.outputFacialTransformationMatrixes,
    });
}

/**
 * GPU que ve WebGL desde el worker. Solo informativo: "SwiftShader" indica
 * que no hay GPU real y la "GPU" de MediaPipe se emula por software.
 */
function detectWebGlRenderer(): string | null {
    try {
        const gl = new OffscreenCanvas(1, 1).getContext('webgl2');

        if (gl === null) {
            return null;
        }

        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = String(
            gl.getParameter(
                info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL,
            ),
        );

        gl.getExtension('WEBGL_lose_context')?.loseContext();

        return renderer;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// INIT — Cargar modelo
// ---------------------------------------------------------------------------

async function handleInit(
    assets: MediaPipeRuntimeAssets,
    mediapipeVersion: string,
    preferredDelegate: PreferredDelegate,
    cfg: WorkerConfig,
): Promise<void> {
    config = cfg;

    try {
        const vision = await loadVisionModule(assets.visionBundleUrl);
        const simd = await vision.FilesetResolver.isSimdSupported();
        const fileset = simd ? assets.wasm.simd : assets.wasm.nosimd;

        let delegate: EngineInfo['delegate'] = preferredDelegate;

        try {
            landmarker = await createLandmarker(
                vision,
                fileset,
                assets.modelUrl,
                preferredDelegate,
            );
        } catch (initErr) {
            if (preferredDelegate === 'CPU') {
                throw initErr;
            }

            // El delegado GPU puede fallar en algunos dispositivos.
            console.warn(
                '[GestureWorker] GPU init failed, retrying with CPU:',
                initErr,
            );
            delegate = 'CPU';
            landmarker = await createLandmarker(
                vision,
                fileset,
                assets.modelUrl,
                'CPU',
            );
        }

        // El primer `detectForVideo` compila los shaders (≈200-500 ms en GPU).
        // Ese primer fotograma es el calentamiento: el hilo principal no da
        // el motor por arrancado hasta recibir su RESULT.
        post({
            type: 'READY',
            info: {
                mediapipeVersion,
                delegate,
                simd,
                renderer: detectWebGlRenderer(),
            },
        });
    } catch (err) {
        console.error('[GestureWorker] Init failed:', err);
        post({
            type: 'ERROR',
            code: 'INIT_FAILED',
            message:
                err instanceof Error
                    ? err.message
                    : 'Failed to initialise FaceLandmarker',
        });
    }
}

// ---------------------------------------------------------------------------
// FRAME — Procesar un frame de vídeo
// ---------------------------------------------------------------------------

type FrameAnalysis = {
    gestures: GestureEvent[];
    headPose: HeadPose | null;
    blendshapes: Record<string, number> | null;
};

function handleFrame(
    frameId: number,
    bitmap: ImageBitmap,
    timestamp: number,
): void {
    const receivedAt = epochNow();

    if (!landmarker || paused) {
        bitmap.close();
        post({
            type: 'FRAME_DROPPED',
            frameId,
            reason: landmarker ? 'paused' : 'not_ready',
        });
        return;
    }

    let result: FaceLandmarkerResult;
    const inferenceStart = epochNow();

    try {
        result = landmarker.detectForVideo(bitmap, timestamp);
        consecutiveInferenceErrors = 0;
    } catch (err) {
        consecutiveInferenceErrors++;
        console.warn('[GestureWorker] detectForVideo failed:', err);
        post({ type: 'FRAME_DROPPED', frameId, reason: 'error' });

        if (consecutiveInferenceErrors === MAX_CONSECUTIVE_INFERENCE_ERRORS) {
            post({
                type: 'ERROR',
                code: 'INFERENCE_FAILED',
                message:
                    err instanceof Error
                        ? err.message
                        : 'Face detection failed',
            });
        }
        return;
    } finally {
        bitmap.close();
    }

    const inferenceEnd = epochNow();
    const analysis = analyse(result, timestamp);

    post({
        type: 'RESULT',
        frameId,
        timestamp,
        ...analysis,
        gestureRiseMs: classifier.drainRiseSamples(),
        timing: {
            receivedAt,
            inferenceStart,
            inferenceEnd,
            postedAt: epochNow(),
        },
    });
}

/** Gestos, pose y blendshapes de un fotograma analizado. */
function analyse(
    result: FaceLandmarkerResult,
    timestamp: number,
): FrameAnalysis {
    const hasFace = !!result.faceLandmarks && result.faceLandmarks.length > 0;

    // En Vision Lab, los 52 blendshapes; en juego, solo los que usa el
    // clasificador (Sesión 3.4 §4.2).
    const bsMap = hasFace
        ? blendshapeMapFromResult(
              result.faceBlendshapes ?? [],
              config.enableBlendshapes,
          )
        : null;

    let headPose: HeadPose | null = null;
    if (
        hasFace &&
        result.facialTransformationMatrixes &&
        result.facialTransformationMatrixes.length > 0
    ) {
        const matrix = result.facialTransformationMatrixes[0].data;
        headPose = extractHeadPose(matrix, timestamp);
    }

    // Calibración: no se clasifican gestos (los activos se terminan al
    // empezar, en CALIBRATE_NEUTRAL), pero el cursor sigue a la cabeza.
    if (calibration !== null) {
        calibrate(timestamp, bsMap, headPose);

        return {
            gestures: classifier.releaseAll(timestamp),
            headPose,
            blendshapes: null,
        };
    }

    // Sin cara. Si lleva `FACE_LOST_RELEASE_MS` sin verse, los gestos activos
    // se dan por terminados: un gesto sostenido no debe quedarse "pulsado".
    if (bsMap === null) {
        faceLostSince ??= timestamp;

        return {
            gestures:
                timestamp - faceLostSince >= FACE_LOST_RELEASE_MS
                    ? classifier.releaseAll(faceLostSince)
                    : [],
            headPose: null,
            blendshapes: null,
        };
    }

    faceLostSince = null;

    // Con la cabeza girada, cada gesto deja de fiarse de su señal a partir
    // de su propia tolerancia (`gesture-rules.ts`); el head tracking sigue.
    return {
        gestures: classifier.classify(
            { blendshapes: bsMap, headPose, timestamp },
            config.sensitivity,
            baseline,
        ),
        headPose,
        blendshapes: config.enableBlendshapes ? bsMap : null,
    };
}

// ---------------------------------------------------------------------------
// Calibración
// ---------------------------------------------------------------------------

/** Añade un fotograma a la calibración en curso y avisa si termina. */
function calibrate(
    timestamp: number,
    blendshapes: Record<string, number> | null,
    headPose: HeadPose | null,
): void {
    const progress = calibration?.addFrame({
        timestamp,
        blendshapes,
        headPose,
    });

    if (progress === undefined || progress.status === 'collecting') {
        return;
    }

    calibration = null;

    if (progress.status === 'done') {
        baseline = progress.baseline;
        post({ type: 'CALIBRATED', baseline });

        return;
    }

    // Si falla, se mantiene la línea base anterior (o ninguna).
    post({ type: 'CALIBRATION_FAILED', reason: progress.reason });
}

// ---------------------------------------------------------------------------
// Router de mensajes
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
    const msg = e.data;

    switch (msg.type) {
        case 'INIT':
            void handleInit(
                msg.assets,
                msg.mediapipeVersion,
                msg.delegate,
                msg.config,
            );
            break;

        case 'FRAME':
            handleFrame(msg.frameId, msg.bitmap, msg.timestamp);
            break;

        case 'SET_CONFIG':
            config = { ...config, ...msg.config };
            break;

        case 'CALIBRATE_NEUTRAL':
            calibration = new NeutralCalibration();
            break;

        case 'PAUSE':
            paused = true;
            classifier.reset();
            faceLostSince = null;
            break;

        case 'RESUME':
            paused = false;
            break;

        case 'DESTROY':
            landmarker?.close();
            landmarker = null;
            paused = true;
            self.close();
            break;
    }
};
