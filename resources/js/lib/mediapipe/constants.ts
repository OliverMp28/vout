/**
 * MediaPipe FaceLandmarker blendshape keys and detection constants.
 *
 * Reference: https://ai.google.dev/mediapipe/solutions/vision/face_landmarker
 * These keys are the canonical names emitted by MediaPipe Tasks Vision.
 */

/*
 * Qué blendshapes forman cada gesto, su recorrido, la postura de cabeza en
 * que son fiables y lo que distingue unos gestos de otros: `gesture-rules.ts`.
 */

// ---------------------------------------------------------------------------
// Sensitivity ↔ threshold mapping
// ---------------------------------------------------------------------------

/**
 * Converts user-facing sensitivity (1-10) to a detection threshold (0-1).
 *
 * Higher sensitivity → lower threshold (easier to trigger).
 * Sensitivity 1  = threshold 0.85 (very hard to trigger)
 * Sensitivity 5  = threshold 0.52 (balanced)
 * Sensitivity 10 = threshold 0.10 (very easy)
 */
export function sensitivityToThreshold(sensitivity: number): number {
    const clamped = Math.max(1, Math.min(10, sensitivity));
    return 0.85 - (clamped - 1) * (0.75 / 9);
}

// ---------------------------------------------------------------------------
// Gesture debounce
// ---------------------------------------------------------------------------

/**
 * Minimum ms between two consecutive `hold` events of the **same** gesture
 * while it stays active.
 *
 * Sesión 3.4 §5.1 — rebajado de 300→180ms. Solo espacia las renovaciones de
 * un gesto sostenido: el inicio (`start`) y el final (`end`) se emiten en el
 * fotograma en que ocurren, sin esperar a este intervalo.
 */
export const GESTURE_DEBOUNCE_MS = 180;

/**
 * Histéresis de suelta: un gesto activo se da por terminado cuando su señal
 * baja de `umbral de activación × GESTURE_RELEASE_RATIO`.
 *
 * Usar un umbral de suelta más bajo que el de activación evita que un gesto
 * sostenido justo en el límite parpadee entre activo e inactivo con el ruido
 * normal de los blendshapes.
 */
export const GESTURE_RELEASE_RATIO = 0.75;

/**
 * Tiempo que la señal debe permanecer por debajo del umbral de suelta para
 * emitir el `end`. Absorbe un fotograma suelto mal medido sin retrasar la
 * suelta de forma perceptible (antes se deducía por inactividad: 600-750 ms).
 */
export const GESTURE_RELEASE_MS = 60;

/**
 * Tiempo sin detectar la cara tras el que se dan por terminados los gestos
 * activos. Más tolerante que `GESTURE_RELEASE_MS`: el detector pierde la
 * cara un instante con cierta frecuencia (boca muy abierta, giro brusco) y
 * eso no debe cortar un gesto sostenido.
 */
export const FACE_LOST_RELEASE_MS = 250;

/**
 * Para medir cuánto tarda un gesto en cruzar su umbral (`gestureRiseMs`): la
 * subida empieza cuando la señal supera `umbral × GESTURE_RISE_FLOOR_RATIO`,
 * por encima del ruido de una cara en reposo. Solo es una medida: no cambia
 * cuándo se detecta el gesto.
 */
export const GESTURE_RISE_FLOOR_RATIO = 0.25;

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
// Ritmo del motor
// ---------------------------------------------------------------------------

/*
 * No hay un fps objetivo: el motor analiza cada imagen nueva de la cámara con
 * un solo fotograma en vuelo hacia el worker (`frame-pump.ts`). Su ritmo es el
 * menor entre los fps de la cámara y lo que tarde la inferencia, sin cola.
 * Sustituye a los `FPS_TIERS` de la Fase 3.4, que limitaban el envío por
 * intervalo pero no evitaban que los fotogramas se acumularan en el worker.
 */

/**
 * Si el worker no responde a un fotograma en este tiempo, el motor se da por
 * bloqueado y falla con un error (el usuario puede reintentar). Una inferencia
 * normal tarda decenas de ms; la primera compila los shaders y, sin GPU real,
 * puede tardar varios segundos.
 */
export const FRAME_RESPONSE_TIMEOUT_MS = 15_000;

/**
 * Si `requestVideoFrameCallback` no avisa de ninguna imagen en este tiempo con
 * el vídeo listo, se pasa a detectar las imágenes nuevas por sondeo. Un
 * `<video>` que no se ve en pantalla puede no llegar a componerse y entonces
 * ese aviso no llega nunca.
 */
export const VIDEO_FRAME_CALLBACK_SILENCE_MS = 1000;

/** Ventana de las métricas que ve la interfaz (fps, inferencia, cámara). */
export const METRICS_WINDOW_MS = 2000;

/** Cada cuánto se recalculan esas métricas mientras el motor está en marcha. */
export const METRICS_EMIT_INTERVAL_MS = 500;

/** Si el motor no avisa de que está listo en este tiempo, se da por fallido. */
export const ENGINE_INIT_TIMEOUT_MS = 30_000;

/**
 * Fallos seguidos de `detectForVideo` tras los que el motor deja de intentarlo
 * y avisa del error. Uno suelto se ignora (se descarta ese fotograma).
 */
export const MAX_CONSECUTIVE_INFERENCE_ERRORS = 30;

// ---------------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------------

/**
 * Frecuencia que se pide a la cámara. Es `ideal`: la que no llegue entrega la
 * suya. A más fps, la imagen que se analiza es más reciente. Si con alguna
 * cámara la imagen sale demasiado oscura (menos exposición por fotograma),
 * bajar a 30.
 */
export const CAMERA_FRAME_RATE_IDEAL = 60;

/**
 * Aviso de cámara lenta: por debajo de `LOW_CAMERA_FPS` durante
 * `LOW_CAMERA_FPS_SUSTAIN_MS` se avisa al usuario (suele ser falta de luz:
 * la exposición automática baja los fps). Desaparece al superar
 * `LOW_CAMERA_FPS_RECOVER` (histéresis, para que no parpadee).
 */
export const LOW_CAMERA_FPS = 20;
export const LOW_CAMERA_FPS_RECOVER = 24;
export const LOW_CAMERA_FPS_SUSTAIN_MS = 3000;

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

/** Fotogramas válidos que se promedian para la línea base neutral. */
export const CALIBRATION_FRAME_COUNT = 30;

/**
 * Tiempo máximo de una calibración, contado desde su primer fotograma. Si en
 * ese tiempo no se reúnen `CALIBRATION_FRAME_COUNT` fotogramas válidos, falla
 * y se sigue jugando con la línea base anterior (o sin ninguna).
 */
export const CALIBRATION_TIMEOUT_MS = 8000;

/**
 * Giro máximo de la cabeza (en la escala normalizada de `head-pose.ts`) para
 * que un fotograma valga como "de frente": ≈18° a los lados y ≈12° arriba o
 * abajo. La línea base tomada con la cabeza girada falsea los gestos al volver
 * al frente (las cejas, sobre todo, cambian mucho con la inclinación).
 */
export const CALIBRATION_MAX_HEAD_ROTATION = 0.4;

/**
 * Si algún blendshape de los que usa el clasificador supera este valor, la
 * cara no está relajada (sonrisa, boca abierta, cejas arriba) y el fotograma
 * no vale para la línea base.
 */
export const CALIBRATION_RELAXED_MAX = 0.45;

// ---------------------------------------------------------------------------
// Frame capture
// ---------------------------------------------------------------------------

/**
 * Ancho del ImageBitmap que se transfiere al worker. El alto sale de la
 * proporción de la cámara (`captureSize` en `frame-capture.ts`) para no
 * deformar la cara: 320×240 con una cámara 4:3.
 *
 * Se probó 256×192 (Sesión 3.4 §4.1) pero inferenceMs p50 subió de 51→56ms.
 */
export const CAPTURE_WIDTH = 320;

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

/**
 * Modelo de Face Landmarker servido por Vout (`public/models`, en git). Es el
 * mismo fichero que Google publica como `float16/latest` (v1, mayo de 2023).
 * `VITE_MEDIAPIPE_MODEL_PATH` permite cambiarlo.
 */
export const LOCAL_MODEL_PATH = '/models/face_landmarker.task';

export const DEFAULT_DETECTION_CONFIG = {
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
} as const;
