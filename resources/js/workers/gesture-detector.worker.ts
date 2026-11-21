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
    CALIBRATION_FRAME_COUNT,
    DEFAULT_DETECTION_CONFIG,
    FACE_LOST_RELEASE_MS,
    HEAD_POSE_GESTURE_GATE,
    MAX_CONSECUTIVE_INFERENCE_ERRORS,
    USED_BLENDSHAPE_KEYS,
} from '@/lib/mediapipe/constants';
import {
    classifyGestures,
    drainGestureRiseSamples,
    releaseActiveGestures,
    resetGestureTracking,
} from '@/lib/mediapipe/gesture-classifier';
import { extractHeadPose } from '@/lib/mediapipe/head-pose';
import type {
    EngineInfo,
    GestureEvent,
    HeadPose,
    MediaPipeRuntimeAssets,
    NeutralBaseline,
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

let calibrationSamples: Record<string, number>[] = [];
let isCalibrating = false;

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
    cfg: WorkerConfig,
): Promise<void> {
    config = cfg;

    try {
        const vision = await loadVisionModule(assets.visionBundleUrl);
        const simd = await vision.FilesetResolver.isSimdSupported();
        const fileset = simd ? assets.wasm.simd : assets.wasm.nosimd;

        let delegate: EngineInfo['delegate'] = 'GPU';

        try {
            landmarker = await createLandmarker(
                vision,
                fileset,
                assets.modelUrl,
                'GPU',
            );
        } catch (gpuErr) {
            // El delegado GPU puede fallar en algunos dispositivos.
            console.warn(
                '[GestureWorker] GPU init failed, retrying with CPU:',
                gpuErr,
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
        ...analysis,
        gestureRiseMs: drainGestureRiseSamples(),
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
    // Sin cara. Si lleva `FACE_LOST_RELEASE_MS` sin verse, los gestos activos
    // se dan por terminados: un gesto sostenido no debe quedarse "pulsado".
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        faceLostSince ??= timestamp;

        return {
            gestures:
                timestamp - faceLostSince >= FACE_LOST_RELEASE_MS
                    ? releaseActiveGestures(faceLostSince)
                    : [],
            headPose: null,
            blendshapes: null,
        };
    }

    faceLostSince = null;

    // En Vision Lab, los 52 blendshapes; en juego, solo los que usa el
    // clasificador (Sesión 3.4 §4.2).
    const bsMap = blendshapeMapFromResult(
        result.faceBlendshapes ?? [],
        config.enableBlendshapes,
    );

    // Calibración: se acumulan muestras sin clasificar ni mover el cursor.
    if (isCalibrating) {
        calibrationSamples.push(bsMap);
        if (calibrationSamples.length >= CALIBRATION_FRAME_COUNT) {
            finishCalibration();
        }

        return { gestures: [], headPose: null, blendshapes: null };
    }

    let headPose: HeadPose | null = null;
    if (
        result.facialTransformationMatrixes &&
        result.facialTransformationMatrixes.length > 0
    ) {
        const matrix = result.facialTransformationMatrixes[0].data;
        headPose = extractHeadPose(matrix, timestamp);
    }

    // Sesión 3.4 §6.5 — con la cabeza muy girada los blendshapes frontales se
    // distorsionan (mirar arriba → falso BROW_RAISE). Se suprimen los gestos;
    // el head tracking sigue.
    const headExtremeRotation =
        headPose != null &&
        (Math.abs(headPose.pitch) > HEAD_POSE_GESTURE_GATE ||
            Math.abs(headPose.roll) > HEAD_POSE_GESTURE_GATE);
    const gestures = headExtremeRotation
        ? []
        : classifyGestures(bsMap, config.sensitivity, baseline, timestamp);

    return {
        gestures,
        headPose,
        blendshapes: config.enableBlendshapes ? bsMap : null,
    };
}

// ---------------------------------------------------------------------------
// Calibración
// ---------------------------------------------------------------------------

function finishCalibration(): void {
    isCalibrating = false;

    if (calibrationSamples.length === 0) return;

    // Promediar todos los valores de blendshapes entre los frames capturados.
    const averaged: Record<string, number> = {};
    const sampleCount = calibrationSamples.length;

    for (const sample of calibrationSamples) {
        for (const [key, value] of Object.entries(sample)) {
            averaged[key] = (averaged[key] ?? 0) + value;
        }
    }

    for (const key of Object.keys(averaged)) {
        averaged[key] /= sampleCount;
    }

    baseline = { capturedAt: Date.now(), blendshapes: averaged };
    calibrationSamples = [];

    post({ type: 'CALIBRATED', baseline });
}

// ---------------------------------------------------------------------------
// Router de mensajes
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
    const msg = e.data;

    switch (msg.type) {
        case 'INIT':
            void handleInit(msg.assets, msg.mediapipeVersion, msg.config);
            break;

        case 'FRAME':
            handleFrame(msg.frameId, msg.bitmap, msg.timestamp);
            break;

        case 'SET_CONFIG':
            config = { ...config, ...msg.config };
            break;

        case 'CALIBRATE_NEUTRAL':
            isCalibrating = true;
            calibrationSamples = [];
            break;

        case 'PAUSE':
            paused = true;
            resetGestureTracking();
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
