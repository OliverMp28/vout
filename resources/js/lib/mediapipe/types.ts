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

/** Average blendshape values captured while the user holds a neutral face. */
export type NeutralBaseline = {
    capturedAt: number;
    blendshapes: Record<string, number>;
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

/** Por qué el worker no analizó un fotograma. */
export type FrameDropReason = 'not_ready' | 'paused' | 'error';

/**
 * Protocolo: por cada `FRAME` el worker responde **exactamente una vez**, con
 * `RESULT` o `FRAME_DROPPED` y el mismo `frameId`. El hilo principal no envía
 * otro fotograma hasta recibir esa respuesta (`frame-pump.ts`).
 */
export type WorkerInMessage =
    | {
          type: 'INIT';
          assets: MediaPipeRuntimeAssets;
          mediapipeVersion: string;
          delegate: PreferredDelegate;
          config: WorkerConfig;
      }
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
    | { type: 'DESTROY' };

export type WorkerOutMessage =
    | { type: 'READY'; info: EngineInfo }
    | {
          type: 'RESULT';
          frameId: number;
          /** Marca del fotograma (la del `FRAME`). */
          timestamp: number;
          gestures: GestureEvent[];
          headPose: HeadPose | null;
          /** Los 52 blendshapes, solo con `enableBlendshapes`. */
          blendshapes: Record<string, number> | null;
          /** Ver `drainGestureRiseSamples`. */
          gestureRiseMs: number[];
          timing: FrameTiming;
      }
    | { type: 'FRAME_DROPPED'; frameId: number; reason: FrameDropReason }
    | { type: 'CALIBRATED'; baseline: NeutralBaseline }
    | { type: 'CALIBRATION_FAILED'; reason: CalibrationFailureReason }
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
