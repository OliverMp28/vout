/**
 * Medidas de la cara sacadas de los puntos (landmarks), para lo que los
 * blendshapes no ven bien. Se añaden al mapa de blendshapes como una señal
 * más (con su clave propia): el clasificador, la calibración y las
 * grabaciones las tratan igual.
 *
 * **Labios separados (`lipsApart`).** `jawOpen` mide cuánto baja la
 * mandíbula: con los labios entreabiertos y la mandíbula casi quieta apenas
 * se mueve (en la grabación de Oliver, aperturas pequeñas de 0.15-0.27,
 * cuando el umbral por defecto pide 0.36). La distancia entre los labios por
 * dentro es justo lo que se ve en la máscara.
 *
 * Se mide en 3D (MediaPipe da `z` en la escala de `x`) y relativa a la
 * distancia entre los rabillos de los ojos, que no cambia con los gestos ni
 * con la distancia a la cámara.
 *
 * Worker-safe: sin DOM.
 */

/** Clave de la separación de los labios en el mapa de blendshapes. */
export const LIPS_APART_KEY = 'lipsApart';

/**
 * Separación de los labios (relativa a la distancia entre los rabillos de los
 * ojos, ~9 cm) que cuenta como 1: unos 9 mm. Con el recorrido de la boca
 * (`thresholdScale` 0.7), a sensibilidad 5 basta con ~3 mm de separación.
 */
export const LIPS_FULL_GAP_RATIO = 0.1;

/** Índices del modelo de 478 puntos de Face Landmarker. */
const UPPER_INNER_LIP = 13;
const LOWER_INNER_LIP = 14;
const RIGHT_EYE_OUTER_CORNER = 33;
const LEFT_EYE_OUTER_CORNER = 263;

/** Punto normalizado de MediaPipe: `x`, `y` en [0, 1] sobre la imagen. */
export type FacePoint = { x: number; y: number; z?: number };

/** Tamaño de la imagen analizada (los puntos son relativos a ella). */
export type ImageSize = { width: number; height: number };

function distance(a: FacePoint, b: FacePoint, image: ImageSize): number {
    return Math.hypot(
        (a.x - b.x) * image.width,
        (a.y - b.y) * image.height,
        ((a.z ?? 0) - (b.z ?? 0)) * image.width,
    );
}

/**
 * Cuánto están separados los labios, de 0 (cerrados) a 1 (≈9 mm o más), o
 * null si faltan puntos.
 */
export function measureLipsApart(
    points: readonly FacePoint[],
    image: ImageSize,
): number | null {
    const upper = points[UPPER_INNER_LIP];
    const lower = points[LOWER_INNER_LIP];
    const rightEye = points[RIGHT_EYE_OUTER_CORNER];
    const leftEye = points[LEFT_EYE_OUTER_CORNER];

    if (
        upper === undefined ||
        lower === undefined ||
        rightEye === undefined ||
        leftEye === undefined
    ) {
        return null;
    }

    const eyes = distance(rightEye, leftEye, image);

    if (eyes <= 0) {
        return null;
    }

    return Math.min(
        1,
        distance(upper, lower, image) / eyes / LIPS_FULL_GAP_RATIO,
    );
}
