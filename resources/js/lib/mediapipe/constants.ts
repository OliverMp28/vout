/**
 * MediaPipe FaceLandmarker blendshape keys and detection constants.
 *
 * Reference: https://ai.google.dev/mediapipe/solutions/vision/face_landmarker
 * These keys are the canonical names emitted by MediaPipe Tasks Vision.
 */

import { GestureType } from './types';

// ---------------------------------------------------------------------------
// Blendshape key → gesture mapping
// ---------------------------------------------------------------------------

/**
 * Which blendshape(s) to evaluate for each gesture type.
 * When multiple keys are listed the classifier takes the **max** value
 * across them before comparing against the threshold.
 */
export const GESTURE_BLENDSHAPE_MAP: Record<GestureType, string[]> = {
    // Gestos originales
    [GestureType.BrowRaise]: ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'],
    [GestureType.MouthOpen]: ['jawOpen'],
    [GestureType.BlinkLeft]: ['eyeBlinkLeft'],
    [GestureType.BlinkRight]: ['eyeBlinkRight'],
    // Gestos faciales extendidos (Sesion 0 — 3.2)
    [GestureType.Smile]: ['mouthSmileLeft', 'mouthSmileRight'],
    [GestureType.BrowFrown]: ['browDownLeft', 'browDownRight'],
    [GestureType.MouthPucker]: ['mouthPucker'],
} as const;

/**
 * Per-gesture threshold multiplier (0 < scale ≤ 1).
 *
 * Some blendshapes have inherently low amplitude. Applying a scale < 1
 * lowers the effective threshold without changing the user-facing sensitivity.
 *
 * Effective threshold = sensitivityToThreshold(sensitivity) * scale
 *
 * Gestures with no entry here default to scale 1.0 (no adjustment).
 */
export const GESTURE_THRESHOLD_SCALE: Partial<Record<GestureType, number>> = {};

// ---------------------------------------------------------------------------
// Sensitivity ↔ threshold mapping
// ---------------------------------------------------------------------------

/**
 * Converts user-facing sensitivity (1-10) to a detection threshold (0-1).
 *
 * Higher sensitivity → lower threshold (easier to trigger).
 * Sensitivity 1  = threshold 0.85 (very hard to trigger)
 * Sensitivity 5  = threshold 0.45 (balanced)
 * Sensitivity 10 = threshold 0.10 (very easy)
 */
export function sensitivityToThreshold(sensitivity: number): number {
    const clamped = Math.max(1, Math.min(10, sensitivity));
    return 0.85 - (clamped - 1) * (0.75 / 9);
}

// ---------------------------------------------------------------------------
// Gesture debounce
// ---------------------------------------------------------------------------

/** Minimum ms between two consecutive events of the **same** gesture. */
export const GESTURE_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Head pose
// ---------------------------------------------------------------------------

/** Landmark indices used as fallback when transformation matrix is unavailable. */
export const HEAD_POSE_LANDMARKS = {
    noseTip: 1,
    foreheadCenter: 10,
    chinCenter: 152,
    leftEye: 33,
    rightEye: 263,
    leftEar: 234,
    rightEar: 454,
} as const;

// ---------------------------------------------------------------------------
// Performance tiers
// ---------------------------------------------------------------------------

/** Target FPS thresholds keyed by average inference time (ms). */
export const FPS_TIERS = [
    { maxInferenceMs: 33, targetFps: 30 },
    { maxInferenceMs: 50, targetFps: 20 },
    { maxInferenceMs: 100, targetFps: 15 },
    { maxInferenceMs: 200, targetFps: 10 },
] as const;

/** Absolute minimum FPS — below this the engine should warn the user. */
export const MIN_VIABLE_FPS = 5;

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

/** Number of frames to average during neutral calibration. */
export const CALIBRATION_FRAME_COUNT = 30;

// ---------------------------------------------------------------------------
// Frame capture
// ---------------------------------------------------------------------------

/** Resolution used for the ImageBitmap sent to the worker (saves bandwidth). */
export const CAPTURE_WIDTH = 320;
export const CAPTURE_HEIGHT = 240;

// ---------------------------------------------------------------------------
// Model defaults
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ---------------------------------------------------------------------------
// MediaPipe CDN — versión fija
// ---------------------------------------------------------------------------

/**
 * Versión de @mediapipe/tasks-vision usada en runtime (CDN).
 * Es la misma versión del ejemplo oficial de Google que se verificó funcional
 * en "ejemplos mediapipe/deteccion de gestos2/". Si se actualiza, verificar
 * compatibilidad con el WASM y el ESM bundle (vision_bundle.mjs).
 */
export const MEDIAPIPE_VERSION = '0.10.3';

/**
 * URL base del paquete en CDN. Se usa para construir las URLs del ESM bundle
 * y del directorio WASM. Centralizada aquí para que un cambio de versión
 * propague automáticamente a ambos.
 */
export const MEDIAPIPE_CDN_BASE =
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;

/**
 * Ruta CDN al directorio WASM. FilesetResolver.forVisionTasks() usa esta URL
 * para cargar los binarios WASM y su glue code JS.
 */
export const WASM_CDN_PATH = `${MEDIAPIPE_CDN_BASE}/wasm`;

export const DEFAULT_DETECTION_CONFIG = {
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
} as const;
