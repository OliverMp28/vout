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
} as const;

export type GestureType = (typeof GestureType)[keyof typeof GestureType];

export type GestureEvent = {
    gesture: GestureType;
    confidence: number;
    timestamp: number;
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

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export type PerformanceMetrics = {
    fps: number;
    inferenceMs: number;
    targetFps: number;
};

export type DeviceTier = 'high' | 'mid' | 'low';

// ---------------------------------------------------------------------------
// Worker configuration
// ---------------------------------------------------------------------------

export type WorkerConfig = {
    sensitivity: number;
    targetFps: number;
    enableBlendshapes: boolean;
};

// ---------------------------------------------------------------------------
// Worker ↔ Main thread protocol (discriminated unions)
// ---------------------------------------------------------------------------

export type WorkerInMessage =
    | { type: 'INIT'; modelPath: string; wasmPath: string; config: WorkerConfig }
    | { type: 'FRAME'; bitmap: ImageBitmap; timestamp: number }
    | { type: 'SET_CONFIG'; config: Partial<WorkerConfig> }
    | { type: 'CALIBRATE_NEUTRAL' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'DESTROY' };

export type WorkerOutMessage =
    | { type: 'READY' }
    | { type: 'RESULT'; gestures: GestureEvent[]; headPose: HeadPose | null }
    | { type: 'BLENDSHAPES'; values: Record<string, number> }
    | { type: 'PERFORMANCE'; metrics: PerformanceMetrics }
    | { type: 'CALIBRATED'; baseline: NeutralBaseline }
    | { type: 'ERROR'; code: string; message: string };

// ---------------------------------------------------------------------------
// Gesture engine status (React-side)
// ---------------------------------------------------------------------------

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'running' | 'paused' | 'error';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

// ---------------------------------------------------------------------------
// Gesture mapping (DB ↔ frontend)
// ---------------------------------------------------------------------------

/**
 * Maps a gesture type to a game action name.
 * Matches the JSON stored in `gesture_configs.gesture_mapping`.
 */
export type GestureMapping = Partial<Record<GestureType, string>>;

export type GestureConfigData = {
    id: number;
    profile_name: string;
    detection_mode: string;
    sensitivity: number;
    gesture_mapping: GestureMapping;
    is_active: boolean;
};
