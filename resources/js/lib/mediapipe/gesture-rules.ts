/**
 * Reglas de cada gesto: de qué blendshapes sale su señal, cuánto recorrido
 * tiene y cuándo no hay que fiarse de ella.
 *
 * Ajustadas con grabaciones guiadas reales de Vision Lab, que se reproducen
 * como test de regresión (`tests/js/mediapipe/gesture-recordings.test.ts`).
 * Lo que enseñaron:
 *
 *   - `jawOpen` tiene menos recorrido que el resto: abrir bien la boca da
 *     0.3-0.4 sobre la cara neutra, mientras que cejas, sonrisa o morritos
 *     llegan a 0.7-0.9. Con un umbral común, la boca no llegaba nunca.
 *   - Un parpadeo normal cierra los dos ojos a la vez (y disparaba los dos
 *     guiños). Un guiño es un ojo bastante más cerrado que el otro.
 *   - Al guiñar baja la ceja de ese lado (disparaba el ceño). El ceño
 *     fruncido baja las dos.
 *   - Al hablar, las "o" y las "u" ponen morritos un instante, pero con la
 *     mandíbula abierta. Los morritos de verdad se hacen con ella cerrada.
 *   - Al mirar hacia arriba suben las cejas solas (0.3 con la cabeza muy
 *     levantada): con la boca abierta, se disparaban antes que la boca. Al
 *     girar la cabeza, el ojo más lejano parece más cerrado. La boca, en
 *     cambio, se mide bien en cualquier postura.
 *   - `jawOpen` no ve los labios entreabiertos con la mandíbula casi quieta:
 *     la boca también cuenta la separación de los labios medida con los
 *     puntos (`face-measures.ts`). Al abrir la boca a propósito no se sonríe
 *     ni se ponen morritos (0 en la grabación); con una sonrisa enseñando los
 *     dientes o con las "o" al hablar (morritos de 0.5-0.8), los labios se
 *     separan sin querer abrir la boca.
 *   - Al sonreír, los labios se separan antes de que la sonrisa pase de 0.3
 *     (0.18-0.27 en el fotograma en que se abren) y siguen separados un
 *     momento al relajarla: la boca empezaba con la sonrisa, se mantenía
 *     durante toda ella y el dino se agachaba al dejar de sonreír. Al guiñar
 *     también se tuerce la boca. Mientras se sonríe o se guiña, y un rato
 *     después, la separación de los labios no cuenta; la mandíbula sí.
 *   - Una sonrisa muy grande achina los ojos y baja las dos cejas (0.5 sobre
 *     la cara neutra): disparaba el ceño.
 *
 * Worker-safe: sin DOM ni React.
 */

import { LIPS_APART_KEY } from './face-measures';
import { GestureType } from './types';
import type { HeadPose, NeutralPose } from './types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/**
 * Cuánto puede alejarse la cabeza de su postura neutra (la de la calibración)
 * sin que la señal del gesto deje de ser fiable, en la escala normalizada de
 * `head-pose.ts` (giro: 1 = 45°; cabeceo: 1 = 30°).
 */
export type PoseTolerance = {
    /** Giro a izquierda o derecha. */
    turn: number;
    /** Cabeza levantada (mirar arriba). */
    up: number;
    /** Cabeza bajada (mirar abajo). */
    down: number;
};

/**
 * Valor de un blendshape en el fotograma menos el de la cara neutra, sin
 * bajar de 0. Es lo que miden las reglas.
 */
export type SignalReader = (key: string) => number;

export type GestureRule = {
    /** Blendshapes de los que sale la señal del gesto. */
    keys: readonly string[];
    /**
     * Cómo se combinan: `max` si basta con uno (cualquier ceja levantada),
     * `min` si tienen que moverse todos (el ceño baja las dos cejas).
     */
    combine: 'max' | 'min';
    /**
     * Multiplicador del umbral de la sensibilidad (`sensitivityToThreshold`)
     * para los blendshapes con poco recorrido. 1 = sin ajuste.
     */
    thresholdScale: number;
    poseTolerance: PoseTolerance;
    /**
     * Condición extra para que el gesto pueda empezar en este fotograma
     * (no para mantenerlo). Distingue el gesto de otros que mueven los mismos
     * músculos.
     */
    canStart?: (signal: SignalReader) => boolean;
    /** Blendshapes que usan `canStart` y `mute` además de `keys`. */
    contextKeys?: readonly string[];
    /**
     * Parte de la señal que otro gesto mueve sin querer: mientras se cumple
     * `when`, y `holdMs` después, esas `keys` cuentan como 0 (ni para empezar
     * ni para mantener el gesto). El resto de `keys` sigue contando.
     */
    mute?: {
        keys: readonly string[];
        when: (signal: SignalReader) => boolean;
        holdMs: number;
    };
};

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

/**
 * Diferencia mínima entre los dos ojos para que un cierre cuente como guiño.
 * En un parpadeo normal los dos ojos van a la par (menos de 0.05 de
 * diferencia) y con cansancio un ojo puede quedarse medio cerrado (hasta
 * 0.14); en un guiño, el otro ojo queda entre 0.15 y 0.35 más abierto.
 */
export const WINK_MIN_ASYMMETRY = 0.15;

/**
 * Apertura de la mandíbula por encima de la cual unos morritos son de estar
 * hablando (0.07-0.23): los de verdad se hacen con la boca cerrada (0).
 */
export const PUCKER_MAX_JAW_OPEN = 0.05;

/**
 * Sonrisa y morritos por encima de los cuales unos labios separados no son
 * abrir la boca: se enseñan los dientes al sonreír o se hace una "o" al
 * hablar. Abriendo la boca a propósito los dos están en 0.
 */
export const MOUTH_OPEN_MAX_SMILE = 0.3;
export const MOUTH_OPEN_MAX_PUCKER = 0.35;

/**
 * Sonrisa a partir de la cual los labios separados no cuentan como abrir la
 * boca. Abriéndola a propósito o hablando la sonrisa está en 0 (< 0.01 en la
 * grabación); al empezar a sonreír ya pasa de 0.15 cuando los labios se
 * separan.
 */
export const LIPS_MUTE_SMILE = 0.1;

/**
 * Tiempo que los labios siguen sin contar después de sonreír o guiñar: lo que
 * tardan en volver a juntarse al relajar la cara (~150 ms en la grabación).
 */
export const LIPS_MUTE_HOLD_MS = 350;

/**
 * Sonrisa por encima de la cual unas cejas bajadas no son fruncir el ceño: la
 * sonrisa grande las baja sola (con 0.9 de sonrisa). Frunciendo el ceño no se
 * sonríe.
 */
export const FROWN_MAX_SMILE = 0.5;

/** Tolerancia de postura de los gestos sin una medida propia. */
const DEFAULT_POSE_TOLERANCE: PoseTolerance = {
    turn: 0.45,
    up: 0.45,
    down: 0.45,
};

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

const eyeAsymmetry = (signal: SignalReader): number =>
    signal('eyeBlinkLeft') - signal('eyeBlinkRight');

const smile = (signal: SignalReader): number =>
    Math.max(signal('mouthSmileLeft'), signal('mouthSmileRight'));

export const GESTURE_RULES: Readonly<Record<GestureType, GestureRule>> = {
    [GestureType.BrowRaise]: {
        keys: ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'],
        combine: 'max',
        thresholdScale: 1,
        // Mirar arriba sube las cejas: 0.1 a ~0.2 de cabeceo, 0.3 a ~0.45.
        poseTolerance: { turn: 0.45, up: 0.25, down: 0.45 },
    },
    [GestureType.MouthOpen]: {
        // La mandíbula, o los labios separados aunque la mandíbula no baje.
        keys: ['jawOpen', LIPS_APART_KEY],
        combine: 'max',
        thresholdScale: 0.7,
        // La apertura medida mirando a las esquinas es la misma que de frente.
        poseTolerance: { turn: 0.7, up: 0.7, down: 0.7 },
        canStart: (signal) =>
            smile(signal) < MOUTH_OPEN_MAX_SMILE &&
            signal('mouthPucker') < MOUTH_OPEN_MAX_PUCKER,
        contextKeys: [
            'mouthSmileLeft',
            'mouthSmileRight',
            'mouthPucker',
            'eyeBlinkLeft',
            'eyeBlinkRight',
        ],
        // Sonreír y guiñar separan los labios sin abrir la boca.
        mute: {
            keys: [LIPS_APART_KEY],
            when: (signal) =>
                smile(signal) >= LIPS_MUTE_SMILE ||
                Math.abs(eyeAsymmetry(signal)) >= WINK_MIN_ASYMMETRY,
            holdMs: LIPS_MUTE_HOLD_MS,
        },
    },
    [GestureType.BlinkLeft]: {
        keys: ['eyeBlinkLeft'],
        combine: 'max',
        thresholdScale: 0.85,
        // Girada o bajada, el ojo lejano parece cerrado sin estarlo.
        poseTolerance: { turn: 0.3, up: 0.45, down: 0.3 },
        canStart: (signal) => eyeAsymmetry(signal) >= WINK_MIN_ASYMMETRY,
        contextKeys: ['eyeBlinkRight'],
    },
    [GestureType.BlinkRight]: {
        keys: ['eyeBlinkRight'],
        combine: 'max',
        thresholdScale: 0.85,
        poseTolerance: { turn: 0.3, up: 0.45, down: 0.3 },
        canStart: (signal) => -eyeAsymmetry(signal) >= WINK_MIN_ASYMMETRY,
        contextKeys: ['eyeBlinkLeft'],
    },
    [GestureType.Smile]: {
        keys: ['mouthSmileLeft', 'mouthSmileRight'],
        combine: 'max',
        thresholdScale: 1,
        poseTolerance: { turn: 0.6, up: 0.6, down: 0.6 },
    },
    [GestureType.BrowFrown]: {
        keys: ['browDownLeft', 'browDownRight'],
        combine: 'min',
        thresholdScale: 0.85,
        poseTolerance: DEFAULT_POSE_TOLERANCE,
        // Con un guiño en marcha la ceja de ese lado baja sola, y con una
        // sonrisa grande las dos.
        canStart: (signal) =>
            Math.abs(eyeAsymmetry(signal)) < WINK_MIN_ASYMMETRY &&
            smile(signal) < FROWN_MAX_SMILE,
        contextKeys: [
            'eyeBlinkLeft',
            'eyeBlinkRight',
            'mouthSmileLeft',
            'mouthSmileRight',
        ],
    },
    [GestureType.MouthPucker]: {
        keys: ['mouthPucker'],
        combine: 'max',
        thresholdScale: 1,
        poseTolerance: { turn: 0.6, up: 0.6, down: 0.6 },
        canStart: (signal) => signal('jawOpen') < PUCKER_MAX_JAW_OPEN,
        contextKeys: ['jawOpen'],
    },
};

/**
 * Blendshapes que consumen las reglas. MediaPipe devuelve 52 por fotograma;
 * en modo juego el worker solo envía estos (Vision Lab recibe todos para
 * depurar). Se deriva de las reglas: un gesto nuevo no toca dos sitios.
 */
export const USED_BLENDSHAPE_KEYS: ReadonlySet<string> = new Set(
    Object.values(GESTURE_RULES).flatMap((rule) => [
        ...rule.keys,
        ...(rule.contextKeys ?? []),
    ]),
);

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

/**
 * Señal del gesto: sus blendshapes combinados según la regla.
 *
 * @param muted Si las `keys` de `rule.mute` cuentan como 0.
 */
export function gestureSignal(
    rule: GestureRule,
    signal: SignalReader,
    muted = false,
): number {
    const values = rule.keys.map((key) =>
        muted && rule.mute?.keys.includes(key) ? 0 : signal(key),
    );

    return rule.combine === 'min' ? Math.min(...values) : Math.max(...values);
}

/**
 * Si la cabeza está dentro de la tolerancia del gesto, medida desde su
 * postura neutra (o desde el frente si no se calibró con postura).
 *
 * `pitch` es el giro y `roll` el cabeceo, con `roll` negativo al mirar arriba
 * (ver `head-tracker.ts`).
 */
export function isPoseWithinTolerance(
    pose: HeadPose,
    neutral: NeutralPose | null,
    tolerance: PoseTolerance,
): boolean {
    const turn = Math.abs(pose.pitch - (neutral?.pitch ?? 0));
    const nod = pose.roll - (neutral?.roll ?? 0);

    return (
        turn <= tolerance.turn &&
        (nod < 0 ? -nod <= tolerance.up : nod <= tolerance.down)
    );
}
