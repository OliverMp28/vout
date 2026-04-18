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
// Sliding window y constantes de histéresis
// ---------------------------------------------------------------------------

/**
 * Tamaño de la ventana deslizante de muestras de `inferenceMs`.
 * Aumentado de 10 a 20 (Sesión 3.4) — combinado con reportes más frecuentes
 * desde el worker (cada 20 frames) la ventana se llena más rápido y la
 * estadística es más estable.
 */
const WINDOW_SIZE = 20;

/**
 * Margen de histéresis para evitar oscilación entre tiers (Sesión 3.5).
 *
 * - Para SUBIR de tier (más fps): el avgMs debe estar 10% por debajo del
 *   límite del tier más rápido (`maxInferenceMs * 0.9`).
 * - Para BAJAR de tier (menos fps): el avgMs debe superar el límite del tier
 *   actual en al menos un 10% (`maxInferenceMs * 1.10`).
 */
const HYSTERESIS_UP = 0.9;
const HYSTERESIS_DOWN = 1.1;

export class PerformanceAdapter {
    private samples: number[] = [];
    /**
     * Índice del tier actual dentro de `FPS_TIERS`. Empieza en 0 (más rápido)
     * para arrancar de forma optimista — el adapter degrada si el device no
     * sostiene el ritmo.
     */
    private currentTierIndex = 0;
    private currentTargetFps: number = FPS_TIERS[0].targetFps;

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

        const avgMs =
            this.samples.reduce((a, b) => a + b, 0) / this.samples.length;

        // Intentar SUBIR de tier (índice más bajo = más rápido) si hay margen.
        while (this.currentTierIndex > 0) {
            const fasterTier = FPS_TIERS[this.currentTierIndex - 1];
            if (avgMs <= fasterTier.maxInferenceMs * HYSTERESIS_UP) {
                this.currentTierIndex--;
            } else {
                break;
            }
        }

        // Intentar BAJAR de tier (índice más alto = más lento) si nos pasamos.
        while (this.currentTierIndex < FPS_TIERS.length - 1) {
            const currentTier = FPS_TIERS[this.currentTierIndex];
            if (avgMs > currentTier.maxInferenceMs * HYSTERESIS_DOWN) {
                this.currentTierIndex++;
            } else {
                break;
            }
        }

        // Si incluso el tier más lento no aguanta, caemos a MIN_VIABLE_FPS.
        const slowestTier = FPS_TIERS[FPS_TIERS.length - 1];
        const isAtFloor = this.currentTierIndex === FPS_TIERS.length - 1;
        const targetFps =
            isAtFloor && avgMs > slowestTier.maxInferenceMs * HYSTERESIS_DOWN
                ? MIN_VIABLE_FPS
                : FPS_TIERS[this.currentTierIndex].targetFps;

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
        if (this.currentTargetFps >= 40) return 'high';
        if (this.currentTargetFps >= 20) return 'mid';
        return 'low';
    }

    reset(): void {
        this.samples = [];
        this.currentTierIndex = 0;
        this.currentTargetFps = FPS_TIERS[0].targetFps;
    }
}
