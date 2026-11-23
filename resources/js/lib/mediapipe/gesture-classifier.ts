/**
 * Clasificación de gestos a partir de los blendshapes de MediaPipe.
 *
 * Cada gesto es una pequeña máquina de estados (inactivo ↔ activo) que emite
 * tres clases de evento:
 *
 *   - `start` en el fotograma en que la señal supera el umbral de activación.
 *   - `hold`  cada `GESTURE_DEBOUNCE_MS` mientras sigue activo.
 *   - `end`   cuando la señal lleva `GESTURE_RELEASE_MS` por debajo del
 *             umbral de suelta (histéresis, `GESTURE_RELEASE_RATIO`).
 *
 * Emitir el final de forma explícita es lo que permite a un juego distinguir
 * un toque de una pulsación mantenida y encadenar gestos rápidos.
 *
 * Qué señal tiene cada gesto, su recorrido, la postura de cabeza en que es
 * fiable y qué lo distingue de otros gestos está en `gesture-rules.ts`. Fuera
 * de esa postura la señal cuenta como 0: el gesto no empieza y, si estaba
 * activo, termina (no se queda "pulsado").
 *
 * Además mide, sin influir en la detección, cuánto tarda cada gesto en
 * cruzar su umbral desde que la señal empieza a subir (`drainRiseSamples`).
 *
 * Worker-safe: sin DOM ni React.
 */

import {
    GESTURE_DEBOUNCE_MS,
    GESTURE_RELEASE_MS,
    GESTURE_RELEASE_RATIO,
    GESTURE_RISE_FLOOR_RATIO,
    sensitivityToThreshold,
} from './constants';
import {
    GESTURE_RULES,
    gestureSignal,
    isPoseWithinTolerance,
} from './gesture-rules';
import type { GestureRule, SignalReader } from './gesture-rules';
import type {
    GestureEvent,
    GestureType,
    HeadPose,
    NeutralBaseline,
} from './types';

/** Lo que el clasificador necesita de un fotograma con cara. */
export type ClassifierFrame = {
    /** Blendshapes de MediaPipe (0-1). */
    blendshapes: Record<string, number>;
    /** Postura de la cabeza, o null si MediaPipe no dio la matriz. */
    headPose: HeadPose | null;
    timestamp: number;
};

type GestureTracking = {
    /** Timestamp del último `start` o `hold` emitido. */
    lastEmittedAt: number;
    /** Primer fotograma seguido por debajo del umbral de suelta, o null. */
    belowSince: number | null;
};

/**
 * Umbral de activación de un gesto con una sensibilidad (1-10): el de la
 * sensibilidad ajustado al recorrido del gesto.
 */
export function activationThreshold(
    gesture: GestureType,
    sensitivity: number,
): number {
    return (
        sensitivityToThreshold(sensitivity) *
        GESTURE_RULES[gesture].thresholdScale
    );
}

export class GestureClassifier {
    /** Gestos activos. Un gesto ausente del mapa está inactivo. */
    private readonly active = new Map<GestureType, GestureTracking>();

    /**
     * Gestos inactivos cuya señal ya superó el suelo de subida: momento del
     * primer fotograma por encima. Se borra si la señal vuelve a bajar.
     */
    private readonly risingSince = new Map<GestureType, number>();

    /** Tiempos de subida (ms) de los `start` emitidos desde el último drenado. */
    private riseSamples: number[] = [];

    /** Hasta cuándo está silenciada la parte `mute` de cada gesto. */
    private readonly mutedUntil = new Map<GestureType, number>();

    /**
     * Clasifica un fotograma.
     *
     * @param sensitivity - Sensibilidad del usuario (1-10).
     * @param baseline    - Cara neutra: se resta a cada blendshape y su
     *                      postura es el "frente" de las tolerancias.
     * @returns Los eventos de este fotograma (puede no haber ninguno).
     */
    classify(
        frame: ClassifierFrame,
        sensitivity: number,
        baseline: NeutralBaseline | null,
    ): GestureEvent[] {
        const { blendshapes, headPose, timestamp } = frame;
        const neutral = baseline?.blendshapes;
        const signal: SignalReader = (key) =>
            Math.max(0, (blendshapes[key] ?? 0) - (neutral?.[key] ?? 0));
        const events: GestureEvent[] = [];

        for (const [gesture, rule] of Object.entries(GESTURE_RULES) as [
            GestureType,
            GestureRule,
        ][]) {
            const reliable =
                headPose === null ||
                isPoseWithinTolerance(
                    headPose,
                    baseline?.headPose ?? null,
                    rule.poseTolerance,
                );
            const value = reliable
                ? gestureSignal(
                      rule,
                      signal,
                      this.isMuted(gesture, rule, signal, timestamp),
                  )
                : 0;
            const threshold = activationThreshold(gesture, sensitivity);
            const event = this.track(
                gesture,
                rule,
                value,
                threshold,
                signal,
                timestamp,
            );

            if (event !== null) {
                events.push(event);
            }
        }

        return events;
    }

    /**
     * Da por terminados todos los gestos activos. Lo usa el worker cuando deja
     * de ver la cara el tiempo suficiente o al calibrar: sin señal fiable, un
     * gesto sostenido no debe quedarse "pulsado".
     */
    releaseAll(timestamp: number): GestureEvent[] {
        const events: GestureEvent[] = [];

        for (const gesture of this.active.keys()) {
            events.push({ gesture, confidence: 0, timestamp, phase: 'end' });
        }
        this.active.clear();

        return events;
    }

    /**
     * Olvida el estado de todos los gestos sin emitir nada: al pausar, para
     * que un estado viejo no bloquee los eventos al reanudar.
     */
    reset(): void {
        this.active.clear();
        this.risingSince.clear();
        this.mutedUntil.clear();
        this.riseSamples = [];
    }

    /**
     * Devuelve y olvida los tiempos de subida medidos: para cada `start`, los
     * ms desde el primer fotograma en que la señal superó el suelo de subida
     * hasta el que cruzó el umbral. 0 si lo cruzó de un fotograma a otro.
     *
     * Es telemetría: dice cuánto retraso añade el umbral al gesto.
     */
    drainRiseSamples(): number[] {
        const samples = this.riseSamples;
        this.riseSamples = [];

        return samples;
    }

    /** Avanza la máquina de estados de un gesto y devuelve su evento, si hay. */
    private track(
        gesture: GestureType,
        rule: GestureRule,
        value: number,
        threshold: number,
        signal: SignalReader,
        timestamp: number,
    ): GestureEvent | null {
        const tracking = this.active.get(gesture);

        if (tracking === undefined) {
            this.trackRise(gesture, value, threshold, timestamp);

            if (value < threshold || !(rule.canStart?.(signal) ?? true)) {
                return null;
            }

            this.riseSamples.push(
                timestamp - (this.risingSince.get(gesture) ?? timestamp),
            );
            this.risingSince.delete(gesture);
            this.active.set(gesture, {
                lastEmittedAt: timestamp,
                belowSince: null,
            });

            return { gesture, confidence: value, timestamp, phase: 'start' };
        }

        if (value >= threshold * GESTURE_RELEASE_RATIO) {
            tracking.belowSince = null;

            if (timestamp - tracking.lastEmittedAt < GESTURE_DEBOUNCE_MS) {
                return null;
            }

            tracking.lastEmittedAt = timestamp;

            return { gesture, confidence: value, timestamp, phase: 'hold' };
        }

        tracking.belowSince ??= timestamp;

        if (timestamp - tracking.belowSince < GESTURE_RELEASE_MS) {
            return null;
        }

        this.active.delete(gesture);

        return {
            gesture,
            confidence: value,
            timestamp: tracking.belowSince,
            phase: 'end',
        };
    }

    /**
     * Si la parte `mute` del gesto está silenciada en este fotograma: mientras
     * se cumple su condición y `holdMs` después.
     */
    private isMuted(
        gesture: GestureType,
        rule: GestureRule,
        signal: SignalReader,
        timestamp: number,
    ): boolean {
        if (rule.mute === undefined) {
            return false;
        }

        if (rule.mute.when(signal)) {
            this.mutedUntil.set(gesture, timestamp + rule.mute.holdMs);

            return true;
        }

        return timestamp < (this.mutedUntil.get(gesture) ?? -Infinity);
    }

    /** Anota el inicio de la subida de un gesto inactivo, o lo olvida si cae. */
    private trackRise(
        gesture: GestureType,
        value: number,
        threshold: number,
        timestamp: number,
    ): void {
        if (value < threshold * GESTURE_RISE_FLOOR_RATIO) {
            this.risingSince.delete(gesture);

            return;
        }

        if (!this.risingSince.has(gesture)) {
            this.risingSince.set(gesture, timestamp);
        }
    }
}
