/**
 * Web Worker de detección de gestos.
 *
 * Ejecuta MediaPipe FaceLandmarker fuera del hilo principal para no
 * bloquear el renderizado de los juegos.
 * Protocolo de mensajes tipado: ver lib/mediapipe/types.ts.
 *
 * MediaPipe se carga desde CDN (no desde node_modules) para evitar problemas
 * de resolución de módulos en el contexto del Web Worker. En dev mode el worker
 * corre desde un Blob URL y las dependencias de node_modules transformadas por
 * Vite tienen imports internos que no se resuelven correctamente cross-origin.
 * Cargar desde CDN (igual que el ejemplo oficial de Google) elimina esta clase
 * de errores por completo.
 *
 * @see https://ai.google.dev/mediapipe/solutions/vision/face_landmarker
 */

// Type-only import — se elimina en compilación. Nos da autocompletado y
// type-safety sin crear una dependencia runtime sobre node_modules.
import type { FaceLandmarker as FaceLandmarkerInstance } from '@mediapipe/tasks-vision';

import {
    CALIBRATION_FRAME_COUNT,
    DEFAULT_DETECTION_CONFIG,
    HEAD_POSE_GESTURE_GATE,
    MEDIAPIPE_CDN_BASE,
    USED_BLENDSHAPE_KEYS,
} from '@/lib/mediapipe/constants';
import {
    classifyGestures,
    resetDebouncers,
} from '@/lib/mediapipe/gesture-classifier';
import { extractHeadPose } from '@/lib/mediapipe/head-pose';
import { PerformanceAdapter } from '@/lib/mediapipe/performance-adapter';
import type {
    NeutralBaseline,
    WorkerConfig,
    WorkerInMessage,
    WorkerOutMessage,
} from '@/lib/mediapipe/types';

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
    targetFps: 30,
    enableBlendshapes: false,
};
let baseline: NeutralBaseline | null = null;

const perf = new PerformanceAdapter();

// Acumulador de calibración
let calibrationSamples: Record<string, number>[] = [];
let isCalibrating = false;

let frameCounter = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(msg: WorkerOutMessage): void {
    self.postMessage(msg);
}

/**
 * Convierte las categorías crudas de MediaPipe en un diccionario `{nombre: score}`.
 *
 * @param blendshapes Array devuelto por `detectForVideo().faceBlendshapes`.
 * @param includeAll  Si `true`, devuelve las 52 categorías (modo Vision Lab).
 *                    Si `false`, devuelve sólo las claves que el classifier
 *                    realmente consume (ver `USED_BLENDSHAPE_KEYS`). Sesión 3.4 §4.2
 *                    — reduce ~80% el tamaño del record por frame y el coste
 *                    de serialización del postMessage `BLENDSHAPES`, y el
 *                    recálculo del baseline en calibración.
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
 * Carga MediaPipe Tasks Vision desde CDN.
 *
 * Usa import() dinámico con la URL del ESM bundle (vision_bundle.mjs). El
 * comentario @vite-ignore evita que Vite/Rollup intente resolver o bundlear
 * esta URL — debe mantenerse como import dinámico en runtime tanto en dev
 * como en prod.
 *
 * Patrón idéntico al ejemplo oficial de Google MediaPipe:
 * `import { FaceLandmarker, FilesetResolver } from '.../vision_bundle.mjs'`
 */
async function loadMediaPipeFromCDN() {
    const cdnUrl = `${MEDIAPIPE_CDN_BASE}/vision_bundle.mjs`;
    console.log('[GestureWorker] Importing MediaPipe from CDN:', cdnUrl);

    const vision = await import(/* @vite-ignore */ cdnUrl);

    if (!vision.FaceLandmarker || !vision.FilesetResolver) {
        throw new Error(
            'MediaPipe CDN module did not export FaceLandmarker or FilesetResolver',
        );
    }

    return {
        FaceLandmarker: vision.FaceLandmarker,
        FilesetResolver: vision.FilesetResolver,
    };
}

// ---------------------------------------------------------------------------
// INIT — Cargar modelo
// ---------------------------------------------------------------------------

async function handleInit(
    modelPath: string,
    wasmPath: string,
    cfg: WorkerConfig,
): Promise<void> {
    config = cfg;
    console.log(
        '[GestureWorker] handleInit — model:',
        modelPath,
        'wasm:',
        wasmPath,
    );

    try {
        const { FaceLandmarker, FilesetResolver } =
            await loadMediaPipeFromCDN();
        console.log(
            '[GestureWorker] MediaPipe imported. Resolving WASM fileset...',
        );

        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        console.log(
            '[GestureWorker] WASM fileset resolved. Creating FaceLandmarker (GPU)...',
        );

        landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: modelPath,
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: DEFAULT_DETECTION_CONFIG.numFaces,
            minFaceDetectionConfidence:
                DEFAULT_DETECTION_CONFIG.minFaceDetectionConfidence,
            minFacePresenceConfidence:
                DEFAULT_DETECTION_CONFIG.minFacePresenceConfidence,
            outputFaceBlendshapes:
                DEFAULT_DETECTION_CONFIG.outputFaceBlendshapes,
            outputFacialTransformationMatrixes:
                DEFAULT_DETECTION_CONFIG.outputFacialTransformationMatrixes,
        });

        // Nota (Sesión 3.4 §4.4): el primer `detectForVideo` incluye la
        // compilación del shader GPU (≈200-500ms) que queda fuera de la ventana
        // deslizante del PerformanceAdapter porque arranca con muestras limpias.
        // No hay que alarmarse si el primer `inferenceMs` es un outlier alto.
        console.log(
            '[GestureWorker] FaceLandmarker created (delegate=GPU). Sending READY.',
        );
        post({ type: 'READY' });
    } catch (gpuErr) {
        // El delegado GPU puede fallar en algunos dispositivos — reintentar con CPU.
        console.warn(
            '[GestureWorker] GPU init failed:',
            gpuErr,
            '— retrying with CPU...',
        );

        try {
            const { FaceLandmarker, FilesetResolver } =
                await loadMediaPipeFromCDN();
            const vision = await FilesetResolver.forVisionTasks(wasmPath);

            landmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: modelPath,
                    delegate: 'CPU',
                },
                runningMode: 'VIDEO',
                numFaces: DEFAULT_DETECTION_CONFIG.numFaces,
                minFaceDetectionConfidence:
                    DEFAULT_DETECTION_CONFIG.minFaceDetectionConfidence,
                minFacePresenceConfidence:
                    DEFAULT_DETECTION_CONFIG.minFacePresenceConfidence,
                outputFaceBlendshapes:
                    DEFAULT_DETECTION_CONFIG.outputFaceBlendshapes,
                outputFacialTransformationMatrixes:
                    DEFAULT_DETECTION_CONFIG.outputFacialTransformationMatrixes,
            });

            console.log(
                '[GestureWorker] FaceLandmarker created (delegate=CPU fallback). Sending READY.',
            );
            post({ type: 'READY' });
        } catch (cpuErr) {
            console.error('[GestureWorker] CPU init also failed:', cpuErr);
            post({
                type: 'ERROR',
                code: 'INIT_FAILED',
                message:
                    cpuErr instanceof Error
                        ? cpuErr.message
                        : 'Failed to initialise FaceLandmarker',
            });
        }
    }
}

// ---------------------------------------------------------------------------
// FRAME — Procesar un frame de vídeo
// ---------------------------------------------------------------------------

function handleFrame(bitmap: ImageBitmap, timestamp: number): void {
    if (!landmarker || paused) {
        bitmap.close();
        return;
    }

    // try/finally garantiza que bitmap.close() se ejecute incluso si
    // detectForVideo lanza una excepción (evita resource leak).
    let result;
    let inferenceMs: number;

    try {
        const t0 = performance.now();
        result = landmarker.detectForVideo(bitmap, timestamp);
        inferenceMs = performance.now() - t0;
    } finally {
        bitmap.close();
    }

    // Sin cara detectada.
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) return;

    // -- Blendshapes --
    // En modo Vision Lab necesitamos las 52 categorías para el panel de debug.
    // En modo juego basta con las 11 que consume `classifyGestures` — ver
    // `USED_BLENDSHAPE_KEYS` en constants.ts (Sesión 3.4 §4.2).
    const bsMap = blendshapeMapFromResult(
        result.faceBlendshapes ?? [],
        config.enableBlendshapes,
    );

    // Modo calibración: acumular muestras.
    if (isCalibrating) {
        calibrationSamples.push(bsMap);
        if (calibrationSamples.length >= CALIBRATION_FRAME_COUNT) {
            finishCalibration();
        }
        return;
    }

    // -- Pose de cabeza (extraer ANTES de clasificar gestos) --
    let headPose = null;
    if (
        result.facialTransformationMatrixes &&
        result.facialTransformationMatrixes.length > 0
    ) {
        const matrix = result.facialTransformationMatrixes[0].data;
        headPose = extractHeadPose(matrix, timestamp);
    }

    // -- Clasificación de gestos --
    // Sesión 3.4 §6.5 — Suprimir clasificación cuando la cabeza está muy
    // rotada. En posiciones extremas la red neuronal distorsiona los
    // blendshapes frontales (ej. mirar arriba → falso BROW_RAISE, mirar
    // abajo → falso MOUTH_OPEN). El head tracking sigue funcionando.
    const headExtremeRotation =
        headPose != null &&
        (Math.abs(headPose.pitch) > HEAD_POSE_GESTURE_GATE ||
            Math.abs(headPose.roll) > HEAD_POSE_GESTURE_GATE);
    const gestures = headExtremeRotation
        ? []
        : classifyGestures(bsMap, config.sensitivity, baseline, timestamp);

    // -- Enviar resultados --
    if (gestures.length > 0 || headPose) {
        post({ type: 'RESULT', gestures, headPose });
    }

    // Enviar blendshapes crudos si el modo Vision Lab está activo.
    if (config.enableBlendshapes) {
        post({ type: 'BLENDSHAPES', values: bsMap });
    }

    // -- Métricas de rendimiento (cada 20 frames ≈ 333ms a 60fps) --
    // Sesión 3.4 — cambio de 60 → 20 frames para reaccionar rápido a
    // cambios de carga (degradación o recuperación). El mensaje es pequeño
    // y no está en la ruta caliente de inferencia.
    frameCounter++;
    if (frameCounter % 20 === 0) {
        const metrics = perf.record(inferenceMs);
        post({ type: 'PERFORMANCE', metrics });
    } else {
        perf.record(inferenceMs);
    }

    // -- Telemetría pura (cada frame) --
    post({ type: 'TELEMETRY', inferenceMs, frameTimestamp: timestamp });
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
            handleInit(msg.modelPath, msg.wasmPath, msg.config);
            break;

        case 'FRAME':
            handleFrame(msg.bitmap, msg.timestamp);
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
            resetDebouncers();
            break;

        case 'RESUME':
            paused = false;
            perf.reset();
            break;

        case 'DESTROY':
            landmarker?.close();
            landmarker = null;
            paused = true;
            self.close();
            break;
    }
};
