/**
 * Pure gesture classification from MediaPipe blendshapes.
 *
 * Worker-safe — no DOM or React imports.
 */

import {
    GESTURE_BLENDSHAPE_MAP,
    GESTURE_DEBOUNCE_MS,
    GESTURE_THRESHOLD_SCALE,
    sensitivityToThreshold,
} from './constants';
import type { GestureEvent, GestureType, NeutralBaseline } from './types';

// ---------------------------------------------------------------------------
// Internal debounce state (lives inside the worker scope)
// ---------------------------------------------------------------------------

const lastFiredAt: Partial<Record<GestureType, number>> = {};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify active gestures from a blendshape record.
 *
 * @param blendshapes - Raw blendshape values from MediaPipe (0-1 range).
 * @param sensitivity - User sensitivity setting (1-10).
 * @param baseline    - Optional neutral baseline to subtract.
 * @param timestamp   - Frame timestamp in ms.
 * @returns Array of detected gesture events (may be empty).
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

        // Check threshold — apply per-gesture scale for low-amplitude blendshapes.
        const scale = GESTURE_THRESHOLD_SCALE[gestureType] ?? 1.0;
        if (raw < threshold * scale) continue;

        // Debounce — skip if the same gesture fired too recently.
        const last = lastFiredAt[gestureType] ?? 0;
        if (timestamp - last < GESTURE_DEBOUNCE_MS) continue;

        lastFiredAt[gestureType] = timestamp;
        events.push({ gesture: gestureType, confidence: raw, timestamp });
    }

    return events;
}

/**
 * Reset debounce timers — call when pausing/resuming detection
 * to avoid stale timestamps blocking new events.
 */
export function resetDebouncers(): void {
    for (const key of Object.keys(lastFiredAt) as GestureType[]) {
        delete lastFiredAt[key];
    }
}
