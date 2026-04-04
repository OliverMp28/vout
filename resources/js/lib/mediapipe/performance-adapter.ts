/**
 * Adaptive performance manager for the vision engine.
 *
 * Adjusts the target FPS based on a sliding window of inference times
 * so the engine automatically downgrades on lower-end devices.
 *
 * Worker-safe — no DOM or React imports.
 */

import { FPS_TIERS, MIN_VIABLE_FPS } from './constants';
import type { DeviceTier, PerformanceMetrics } from './types';

// ---------------------------------------------------------------------------
// Sliding window
// ---------------------------------------------------------------------------

const WINDOW_SIZE = 10;

export class PerformanceAdapter {
    private samples: number[] = [];
    private currentTargetFps = 30;

    /**
     * Record an inference time sample and recalculate the target FPS.
     *
     * @returns Updated performance metrics.
     */
    record(inferenceMs: number): PerformanceMetrics {
        this.samples.push(inferenceMs);
        if (this.samples.length > WINDOW_SIZE) {
            this.samples.shift();
        }

        const avgMs = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;

        // Walk the tiers from fastest to slowest — pick the first that fits.
        let targetFps = MIN_VIABLE_FPS;
        for (const tier of FPS_TIERS) {
            if (avgMs <= tier.maxInferenceMs) {
                targetFps = tier.targetFps;
                break;
            }
        }

        this.currentTargetFps = targetFps;

        return {
            fps: targetFps,
            inferenceMs: Math.round(avgMs),
            targetFps,
        };
    }

    /** Current recommended interval between frames (ms). */
    get intervalMs(): number {
        return 1000 / this.currentTargetFps;
    }

    get targetFps(): number {
        return this.currentTargetFps;
    }

    /** Classify the device into a rough performance tier. */
    get deviceTier(): DeviceTier {
        if (this.currentTargetFps >= 25) return 'high';
        if (this.currentTargetFps >= 15) return 'mid';
        return 'low';
    }

    reset(): void {
        this.samples = [];
        this.currentTargetFps = 30;
    }
}
