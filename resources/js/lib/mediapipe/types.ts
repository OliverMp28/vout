/**
 * Core types for the Vout MediaPipe vision engine.
 *
 * All types here are framework-agnostic (no React imports) so they
 * can be used inside Web Workers and pure logic modules alike.
 */

// ---------------------------------------------------------------------------
// Gesture primitives
// ---------------------------------------------------------------------------

export const GestureType = {
    BrowRaise: 'BROW_RAISE',
    MouthOpen: 'MOUTH_OPEN',
    BlinkLeft: 'BLINK_LEFT',
    BlinkRight: 'BLINK_RIGHT',
    Smile: 'SMILE',
    BrowFrown: 'BROW_FROWN',
    MouthPucker: 'MOUTH_PUCKER',
} as const;

export type GestureType = (typeof GestureType)[keyof typeof GestureType];

/**
 * Momento del gesto que representa un evento:
 * - `start` → el gesto acaba de superar su umbral.
 * - `hold`  → sigue activo (se repite cada `GESTURE_DEBOUNCE_MS` mientras dura).
 * - `end`   → el gesto ha terminado: la señal cayó por debajo del umbral de
 *             suelta, o se dejó de ver la cara.
 */
export type GesturePhase = 'start' | 'hold' | 'end';

export type GestureEvent = {
    gesture: GestureType;
    confidence: number;
    /**
     * Marca del fotograma, en la línea de tiempo de `performance.now()` del
     * hilo principal. En un `end` es la del primer fotograma en que el gesto
     * ya no estaba: la mejor estimación de cuándo se soltó.
     */
    timestamp: number;
    phase: GesturePhase;
};

// ---------------------------------------------------------------------------
// Head pose
// ---------------------------------------------------------------------------

/** Normalised head orientation in the range [-1, 1]. */
export type HeadPose = {
    yaw: number;
    pitch: number;
    roll: number;
    timestamp: number;
};

// ---------------------------------------------------------------------------
// Head tracking (cursor mapping)
// ---------------------------------------------------------------------------

export type { HeadTrackPosition } from './head-tracker';

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

/**
 * Postura de la cabeza en la cara neutra: el "frente" del usuario, que no
 * siempre es el de la cámara (una cámara encima de la pantalla ve la cabeza
 * algo bajada). Mismos ejes que `HeadPose`.
 */
export type NeutralPose = {
    pitch: number;
    roll: number;
};

/** Average blendshape values captured while the user holds a neutral face. */
export type NeutralBaseline = {
    capturedAt: number;
    blendshapes: Record<string, number>;
    /** Sin ella, las tolerancias de postura se miden desde la cámara. */
    headPose?: NeutralPose;
};

/**
 * Por qué falló una calibración:
 * - `no_face`     → no se veía la cara.
 * - `not_frontal` → la cabeza no miraba de frente a la cámara.
 * - `not_relaxed` → la cara no estaba relajada (sonrisa, boca abierta…).
 * - `timeout`     → llegaron demasiado pocas imágenes a tiempo.
 */
export type CalibrationFailureReason =
    'no_face' | 'not_frontal' | 'not_relaxed' | 'timeout';

/** Estado de la calibración de la cara neutra en el motor. */
export type CalibrationState =
    | { status: 'idle' }
    | { status: 'calibrating'; automatic: boolean }
    | { status: 'calibrated'; automatic: boolean }
    | {
          status: 'failed';
          automatic: boolean;
          reason: CalibrationFailureReason;
      };

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

/** Métricas del motor que ve la interfaz, sobre una ventana de ~2 s. */
export type PerformanceMetrics = {
    /** Fotogramas analizados por segundo. */
    fps: number;
    /** Media de `detectForVideo`, en ms. */
    inferenceMs: number;
    /** Imágenes por segundo que entrega la cámara, o null si aún no se sabe. */
    cameraFps: number | null;
    /** True mientras la cámara va tan lenta que conviene avisar al usuario. */
    cameraSlow: boolean;
};

/**
 * Lo que tardó el worker en preparar el motor, en ms: importar el bundle de
 * MediaPipe, crear el landmarker (WASM, modelo y GPU) y el primer análisis
 * de calentamiento (compila los shaders del detector).
 */
export type StartupTimings = {
    bundleMs: number;
    landmarkerMs: number;
    warmupMs: number;
};

/** Con qué se ejecuta el motor. Lo informa el worker al arrancar. */
export type EngineInfo = {
    /** Versión de @mediapipe/tasks-vision. */
    mediapipeVersion: string;
    /** Delegado con el que se creó el landmarker. */
    delegate: 'GPU' | 'CPU';
    /** Si se cargó el WASM con SIMD. */
    simd: boolean;
    /**
     * GPU que ve WebGL en el worker, o null si no hay WebGL. "SwiftShader"
     * significa que no hay GPU real y se dibuja por software.
     */
    renderer: string | null;
    startup: StartupTimings;
};

// ---------------------------------------------------------------------------
// Runtime de MediaPipe
// ---------------------------------------------------------------------------

/** URLs absolutas del cargador y el binario WASM de MediaPipe. */
export type WasmFilesetUrls = {
    wasmLoaderPath: string;
    wasmBinaryPath: string;
};

/**
 * Todo lo que el worker necesita descargar, servido por Vout (ver
 * `runtime-assets.ts`). Son URLs absolutas: el worker corre desde un Blob URL
 * y no puede resolver rutas relativas.
 */
export type MediaPipeRuntimeAssets = {
    visionBundleUrl: string;
    wasm: { simd: WasmFilesetUrls; nosimd: WasmFilesetUrls };
    modelUrl: string;
};

// ---------------------------------------------------------------------------
// Worker configuration
// ---------------------------------------------------------------------------

export type WorkerConfig = {
    sensitivity: number;
    /** Devolver los 52 blendshapes en cada RESULT (Vision Lab). */
    enableBlendshapes: boolean;
};

/**
 * Con qué se intenta crear el landmarker. Con `GPU`, si falla, se vuelve a
 * intentar con CPU. `CPU` sirve para comparar en Vision Lab: en algunas GPU
 * integradas la CPU con SIMD es igual de rápida.
 */
export type PreferredDelegate = EngineInfo['delegate'];

// ---------------------------------------------------------------------------
// Vista de la cámara con la malla (la dibuja el worker)
// ---------------------------------------------------------------------------

/**
 * Cuánta malla se dibuja sobre la cara:
 * - `off`      → nada.
 * - `contours` → ojos, cejas, labios, óvalo e iris: pocas líneas.
 * - `full`     → la máscara: la malla de toda la cara (1.322 aristas) y los
 *                contornos encima.
 */
export type MeshLevel = 'off' | 'contours' | 'full';

/**
 * - `overlay` → lienzo transparente sobre un `<video>` visible: el vídeo va
 *   a los fps de la cámara y la malla, al ritmo de la inferencia (un poco
 *   por detrás).
 * - `synced`  → el worker pinta la imagen analizada y su malla: van juntas,
 *   al ritmo de la inferencia, y no hace falta un `<video>` visible.
 */
export type PreviewMode = 'overlay' | 'synced';

/** Colores CSS ya resueltos (el worker no ve las variables de la página). */
export type PreviewColors = {
    /** La malla de triángulos. */
    mesh: string;
    /** Óvalo de la cara y labios. */
    outline: string;
    /** Ojos, cejas e iris. */
    feature: string;
};

export type PreviewOptions = {
    mode: PreviewMode;
    mesh: MeshLevel;
    colors: PreviewColors;
};

/** Tamaño del lienzo en píxeles del dispositivo. */
export type PreviewSize = {
    width: number;
    height: number;
    /** Píxeles del dispositivo por píxel CSS (grosor de las líneas). */
    pixelRatio: number;
};

// ---------------------------------------------------------------------------
// Worker ↔ Main thread protocol (discriminated unions)
// ---------------------------------------------------------------------------

/**
 * Tiempos de un fotograma dentro del worker, en milisegundos de época con
 * precisión de `performance.now()` (`performance.timeOrigin + now()`). Worker
 * y página tienen orígenes de reloj distintos; así se pueden comparar.
 */
export type FrameTiming = {
    receivedAt: number;
    inferenceStart: number;
    inferenceEnd: number;
    postedAt: number;
};

/**
 * Un fotograma ya analizado, tal como lo ve el hilo principal. Lo usa la
 * grabadora de Vision Lab (`gesture-recording.ts`).
 */
export type AnalyzedFrame = {
    timestamp: number;
    headPose: HeadPose | null;
    /** Con `enableBlendshapes`; null sin cara o durante la calibración. */
    blendshapes: Record<string, number> | null;
    gestures: GestureEvent[];
};

/**
 * Por qué el worker no analizó un fotograma. `no_session`: llegó después de
 * cerrar la sesión (o antes de abrirla).
 */
export type FrameDropReason = 'not_ready' | 'paused' | 'error' | 'no_session';

/**
 * Protocolo. Un worker es **el motor cargado** (bundle, WASM, modelo y GPU) y
 * puede servir varias **sesiones** seguidas: cada activación del control
 * facial abre una (`SESSION_START`) con su clasificador, su calibración y su
 * configuración, y la cierra al parar (`SESSION_END`). Así reactivar no
 * recarga el modelo pero sí empieza de cero. Ver `engine-runtime.ts`.
 *
 * Por cada `FRAME` el worker responde **exactamente una vez**, con `RESULT` o
 * `FRAME_DROPPED` y el mismo `frameId`. El hilo principal no envía otro
 * fotograma hasta recibir esa respuesta (`frame-pump.ts`).
 *
 * `SET_CONFIG`, `CALIBRATE_NEUTRAL`, `PAUSE` y `RESUME` actúan sobre la
 * sesión abierta. Las respuestas de una sesión llevan su `sessionId`: el hilo
 * principal descarta las de una sesión anterior que lleguen tarde.
 */
export type WorkerInMessage =
    | {
          type: 'INIT';
          assets: MediaPipeRuntimeAssets;
          mediapipeVersion: string;
          delegate: PreferredDelegate;
      }
    | { type: 'SESSION_START'; sessionId: number; config: WorkerConfig }
    | { type: 'SESSION_END'; sessionId: number }
    | {
          type: 'FRAME';
          frameId: number;
          bitmap: ImageBitmap;
          /** Marca del fotograma en el `performance.now()` de la página. */
          timestamp: number;
      }
    | { type: 'SET_CONFIG'; config: Partial<WorkerConfig> }
    | { type: 'CALIBRATE_NEUTRAL' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | {
          type: 'ATTACH_PREVIEW';
          /** Transferido: desde aquí solo lo toca el worker. */
          canvas: OffscreenCanvas;
          size: PreviewSize;
          options: PreviewOptions;
      }
    | { type: 'RESIZE_PREVIEW'; size: PreviewSize }
    | { type: 'SET_PREVIEW'; options: PreviewOptions }
    | { type: 'DETACH_PREVIEW' }
    | { type: 'DESTROY' };

/** Respuestas que pertenecen a una sesión (ver `WorkerInMessage`). */
export type SessionOutMessage =
    | {
          type: 'RESULT';
          sessionId: number;
          frameId: number;
          /** Marca del fotograma (la del `FRAME`). */
          timestamp: number;
          gestures: GestureEvent[];
          headPose: HeadPose | null;
          /** Los 52 blendshapes, solo con `enableBlendshapes`. */
          blendshapes: Record<string, number> | null;
          /** Ver `GestureClassifier.drainRiseSamples`. */
          gestureRiseMs: number[];
          timing: FrameTiming;
          /**
           * Lo que tardó en dibujarse la vista de la cámara del fotograma
           * anterior (se dibuja después de responder), o null si no se dibujó.
           */
          previewMs: number | null;
      }
    | {
          type: 'FRAME_DROPPED';
          /** Null si no había sesión abierta. */
          sessionId: number | null;
          frameId: number;
          reason: FrameDropReason;
      }
    | { type: 'CALIBRATED'; sessionId: number; baseline: NeutralBaseline }
    | {
          type: 'CALIBRATION_FAILED';
          sessionId: number;
          reason: CalibrationFailureReason;
      };

export type WorkerOutMessage =
    | { type: 'READY'; info: EngineInfo }
    | SessionOutMessage
    | { type: 'ERROR'; code: string; message: string };

// ---------------------------------------------------------------------------
// Gesture engine status (React-side)
// ---------------------------------------------------------------------------

export type EngineStatus =
    'idle' | 'loading' | 'ready' | 'running' | 'paused' | 'error';

export type CameraStatus =
    'idle' | 'requesting' | 'active' | 'denied' | 'error';

// ---------------------------------------------------------------------------
// Gesture mapping (DB ↔ frontend)
// ---------------------------------------------------------------------------

import type { GestureActionMapping, HeadTrackingMode } from './action-types';

export type { GestureActionMapping, HeadTrackingMode };

/**
 * Datos del perfil de gestos tal como llegan desde el backend (Inertia props).
 * Coincide con las columnas de la tabla `gesture_configs`.
 */
export type GestureConfigData = {
    id: number;
    profile_name: string;
    detection_mode: string;
    sensitivity: number;
    gesture_mapping: GestureActionMapping;
    head_tracking_mode: HeadTrackingMode;
    is_active: boolean;
};
