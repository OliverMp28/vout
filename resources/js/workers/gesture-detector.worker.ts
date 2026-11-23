/**
 * Web Worker de detección de gestos.
 *
 * Ejecuta MediaPipe FaceLandmarker fuera del hilo principal para no
 * bloquear el renderizado de los juegos. Protocolo tipado en
 * `lib/mediapipe/types.ts`:
 *
 *   - `INIT` carga MediaPipe una vez y lo calienta (`READY`). El worker es el
 *     **motor cargado** y puede servir varias sesiones seguidas
 *     (`lib/mediapipe/engine-runtime.ts`).
 *   - `SESSION_START` / `SESSION_END` abren y cierran una **sesión**: una
 *     activación del control facial, con su clasificador, su calibración y su
 *     configuración (`lib/mediapipe/detection-session.ts`). Cada sesión
 *     empieza de cero.
 *   - Por cada `FRAME` responde exactamente una vez, con `RESULT` o
 *     `FRAME_DROPPED`, y el hilo principal no envía el siguiente hasta recibir
 *     esa respuesta (`frame-pump.ts`). Así nunca hay cola.
 *   - Si se le cede un lienzo (`ATTACH_PREVIEW`), dibuja en él la vista de la
 *     cámara con la malla de cada fotograma, después de responder
 *     (`lib/mediapipe/preview-renderer.ts`).
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
    CAPTURE_WIDTH,
    DEFAULT_DETECTION_CONFIG,
    MAX_CONSECUTIVE_INFERENCE_ERRORS,
} from '@/lib/mediapipe/constants';
import { DetectionSession } from '@/lib/mediapipe/detection-session';
import type { MeshConnections } from '@/lib/mediapipe/face-mesh-drawing';
import { PreviewRenderer } from '@/lib/mediapipe/preview-renderer';
import type {
    EngineInfo,
    MediaPipeRuntimeAssets,
    PreferredDelegate,
    WasmFilesetUrls,
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

/** El motor cargado: vive lo que el worker. */
let landmarker: FaceLandmarkerInstance | null = null;

/** La activación en curso, o null entre sesiones. */
let session: DetectionSession | null = null;

const preview = new PreviewRenderer();

/** Lo que tardó en dibujarse la vista del último fotograma (va en el siguiente RESULT). */
let lastPreviewMs: number | null = null;

/** Última marca entregada a MediaPipe (exige que crezcan, también entre sesiones). */
let lastDetectTimestamp = -Infinity;

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

/** `detectForVideo` con marcas siempre crecientes, como exige el modo VIDEO. */
function detect(
    instance: FaceLandmarkerInstance,
    image: TexImageSource,
    timestamp: number,
): FaceLandmarkerResult {
    const detectTimestamp = Math.max(timestamp, lastDetectTimestamp + 0.01);

    lastDetectTimestamp = detectTimestamp;

    return instance.detectForVideo(image, detectTimestamp);
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

/** Las líneas de la malla, tal como las publica el bundle. */
function meshConnections(vision: VisionModule): MeshConnections {
    const { FaceLandmarker } = vision;

    return {
        tesselation: FaceLandmarker.FACE_LANDMARKS_TESSELATION ?? [],
        contours: FaceLandmarker.FACE_LANDMARKS_CONTOURS ?? [],
        irises: [
            ...(FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS ?? []),
            ...(FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS ?? []),
        ],
    };
}

/**
 * Primer análisis con una imagen gris: compila los shaders del detector de
 * caras (cientos de ms en GPU, varios segundos sin GPU real) antes de que
 * llegue la cámara. Los del modelo de puntos se compilan con la primera cara.
 *
 * @returns Lo que tardó, en ms.
 */
function warmUp(instance: FaceLandmarkerInstance): number {
    const startedAt = performance.now();

    try {
        const canvas = new OffscreenCanvas(
            CAPTURE_WIDTH,
            Math.round((CAPTURE_WIDTH * 3) / 4),
        );
        const context = canvas.getContext('2d');

        if (context !== null) {
            context.fillStyle = '#808080';
            context.fillRect(0, 0, canvas.width, canvas.height);
        }

        detect(instance, canvas, 0);
    } catch (err) {
        // No es grave: el primer fotograma real hará el mismo trabajo.
        console.warn('[GestureWorker] Warm-up failed:', err);
    }

    return performance.now() - startedAt;
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
// INIT — Cargar y calentar el motor
// ---------------------------------------------------------------------------

async function handleInit(
    assets: MediaPipeRuntimeAssets,
    mediapipeVersion: string,
    preferredDelegate: PreferredDelegate,
): Promise<void> {
    try {
        const startedAt = performance.now();
        const vision = await loadVisionModule(assets.visionBundleUrl);
        const bundleLoadedAt = performance.now();
        const simd = await vision.FilesetResolver.isSimdSupported();
        const fileset = simd ? assets.wasm.simd : assets.wasm.nosimd;

        let delegate: EngineInfo['delegate'] = preferredDelegate;
        let instance: FaceLandmarkerInstance;

        try {
            instance = await createLandmarker(
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
            instance = await createLandmarker(
                vision,
                fileset,
                assets.modelUrl,
                'CPU',
            );
        }

        const landmarkerReadyAt = performance.now();

        preview.setConnections(meshConnections(vision));

        const warmupMs = warmUp(instance);

        landmarker = instance;

        post({
            type: 'READY',
            info: {
                mediapipeVersion,
                delegate,
                simd,
                renderer: detectWebGlRenderer(),
                startup: {
                    bundleMs: bundleLoadedAt - startedAt,
                    landmarkerMs: landmarkerReadyAt - bundleLoadedAt,
                    warmupMs,
                },
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

function handleFrame(
    frameId: number,
    bitmap: ImageBitmap,
    timestamp: number,
): void {
    const receivedAt = epochNow();
    const current = session;

    if (landmarker === null || current === null || current.isPaused) {
        bitmap.close();
        post({
            type: 'FRAME_DROPPED',
            sessionId: current?.id ?? null,
            frameId,
            reason:
                landmarker === null
                    ? 'not_ready'
                    : current === null
                      ? 'no_session'
                      : 'paused',
        });

        return;
    }

    try {
        let result: FaceLandmarkerResult;
        const inferenceStart = epochNow();

        try {
            result = detect(landmarker, bitmap, timestamp);
            consecutiveInferenceErrors = 0;
        } catch (err) {
            consecutiveInferenceErrors++;
            console.warn('[GestureWorker] detectForVideo failed:', err);
            post({
                type: 'FRAME_DROPPED',
                sessionId: current.id,
                frameId,
                reason: 'error',
            });

            if (
                consecutiveInferenceErrors === MAX_CONSECUTIVE_INFERENCE_ERRORS
            ) {
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
        }

        const inferenceEnd = epochNow();
        const { calibration, ...analysis } = current.analyse(result, timestamp);

        if (calibration?.status === 'done') {
            post({
                type: 'CALIBRATED',
                sessionId: current.id,
                baseline: calibration.baseline,
            });
        } else if (calibration?.status === 'failed') {
            post({
                type: 'CALIBRATION_FAILED',
                sessionId: current.id,
                reason: calibration.reason,
            });
        }

        post({
            type: 'RESULT',
            sessionId: current.id,
            frameId,
            timestamp,
            ...analysis,
            gestureRiseMs: current.drainRiseSamples(),
            timing: {
                receivedAt,
                inferenceStart,
                inferenceEnd,
                postedAt: epochNow(),
            },
            previewMs: lastPreviewMs,
        });

        // Los gestos ya van de camino: ahora, la vista de la cámara.
        lastPreviewMs = preview.render({
            image: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            landmarks: result.faceLandmarks?.[0] ?? null,
        });
    } finally {
        bitmap.close();
    }
}

// ---------------------------------------------------------------------------
// Router de mensajes
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
    const msg = e.data;

    switch (msg.type) {
        case 'INIT':
            void handleInit(msg.assets, msg.mediapipeVersion, msg.delegate);
            break;

        case 'SESSION_START':
            session = new DetectionSession(msg.sessionId, msg.config);
            break;

        case 'SESSION_END':
            if (session?.id === msg.sessionId) {
                session = null;
                // Que no se quede la última imagen de la cámara en pantalla.
                preview.clear();
            }
            break;

        case 'FRAME':
            handleFrame(msg.frameId, msg.bitmap, msg.timestamp);
            break;

        case 'SET_CONFIG':
            session?.updateConfig(msg.config);
            break;

        case 'CALIBRATE_NEUTRAL':
            session?.startCalibration();
            break;

        case 'PAUSE':
            session?.pause();
            break;

        case 'RESUME':
            session?.resume();
            break;

        case 'ATTACH_PREVIEW':
            preview.attach(msg.canvas, msg.size, msg.options);
            lastPreviewMs = null;
            break;

        case 'RESIZE_PREVIEW':
            preview.resize(msg.size);
            break;

        case 'SET_PREVIEW':
            preview.setOptions(msg.options);
            break;

        case 'DETACH_PREVIEW':
            preview.detach();
            lastPreviewMs = null;
            break;

        case 'DESTROY':
            preview.detach();
            session = null;
            landmarker?.close();
            landmarker = null;
            self.close();
            break;
    }
};
