/**
 * Pure gesture classification from MediaPipe blendshapes.
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
 * un toque de una pulsación mantenida y encadenar gestos rápidos: antes el
 * final solo podía deducirse por inactividad, más de medio segundo tarde.
 *
 * Worker-safe — no DOM or React imports.
 */

import {
    GESTURE_BLENDSHAPE_MAP,
    GESTURE_DEBOUNCE_MS,
    GESTURE_RELEASE_MS,
    GESTURE_RELEASE_RATIO,
    GESTURE_THRESHOLD_SCALE,
    sensitivityToThreshold,
} from './constants';
import type { GestureEvent, GestureType, NeutralBaseline } from './types';

// ---------------------------------------------------------------------------
// Internal tracking state (lives inside the worker scope)
// ---------------------------------------------------------------------------

type GestureTracking = {
    /** Timestamp del último `start` o `hold` emitido. */
    lastEmittedAt: number;
    /** Primer fotograma seguido por debajo del umbral de suelta, o null. */
    belowSince: number | null;
};

/** Gestos actualmente activos. Un gesto ausente del mapa está inactivo. */
const activeGestures = new Map<GestureType, GestureTracking>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify gestures from a blendshape record.
 *
 * @param blendshapes - Raw blendshape values from MediaPipe (0-1 range).
 * @param sensitivity - User sensitivity setting (1-10).
 * @param baseline    - Optional neutral baseline to subtract.
 * @param timestamp   - Frame timestamp in ms.
 * @returns Gesture events for this frame (may be empty).
 */
export function classifyGestures(
    blendshapes: Record<string, number>,
    sensitivity: number,
    baseline: NeutralBaseline | null,
    timestamp: number,
): GestureEvent[] {
    const threshold = sensitivityToThreshold(sensitivity);
    const events: GestureEvent[] = [];

    for (const [gesture, keys] of Object.entries(GESTURE_BLENDSHAPE_MAP)) {
        const gestureType = gesture as GestureType;

        // Take the max confidence across associated blendshape keys.
        let raw = 0;
        for (const key of keys) {
            const value = blendshapes[key] ?? 0;
            if (value > raw) raw = value;
        }

        // Subtract the neutral baseline if available.
        if (baseline) {
            const baselineMax = Math.max(
                ...keys.map((k) => baseline.blendshapes[k] ?? 0),
            );
            raw = Math.max(0, raw - baselineMax);
        }

        // Apply per-gesture scale for low-amplitude blendshapes.
        const activationThreshold =
            threshold * (GESTURE_THRESHOLD_SCALE[gestureType] ?? 1.0);
        const tracking = activeGestures.get(gestureType);

        if (tracking === undefined) {
            if (raw >= activationThreshold) {
                activeGestures.set(gestureType, {
                    lastEmittedAt: timestamp,
                    belowSince: null,
                });
                events.push({
                    gesture: gestureType,
                    confidence: raw,
                    timestamp,
                    phase: 'start',
                });
            }

            continue;
        }

        if (raw >= activationThreshold * GESTURE_RELEASE_RATIO) {
            tracking.belowSince = null;

            if (timestamp - tracking.lastEmittedAt >= GESTURE_DEBOUNCE_MS) {
                tracking.lastEmittedAt = timestamp;
                events.push({
                    gesture: gestureType,
                    confidence: raw,
                    timestamp,
                    phase: 'hold',
                });
            }

            continue;
        }

        tracking.belowSince ??= timestamp;

        if (timestamp - tracking.belowSince >= GESTURE_RELEASE_MS) {
            activeGestures.delete(gestureType);
            events.push({
                gesture: gestureType,
                confidence: raw,
                timestamp: tracking.belowSince,
                phase: 'end',
            });
        }
    }

    return events;
}

/**
 * Da por terminados todos los gestos activos. Lo usa el worker cuando deja
 * de ver la cara el tiempo suficiente: sin cara no hay señal que medir, y
 * un gesto sostenido no debe quedarse "pulsado".
 *
 * @param timestamp - Momento en que se dejó de ver la cara.
 */
export function releaseActiveGestures(timestamp: number): GestureEvent[] {
    const events: GestureEvent[] = [];

    for (const gesture of activeGestures.keys()) {
        events.push({ gesture, confidence: 0, timestamp, phase: 'end' });
    }
    activeGestures.clear();

    return events;
}

/**
 * Olvida el estado de todos los gestos sin emitir nada — call when
 * pausing/resuming detection so stale state doesn't block new events.
 */
export function resetGestureTracking(): void {
    activeGestures.clear();
}
