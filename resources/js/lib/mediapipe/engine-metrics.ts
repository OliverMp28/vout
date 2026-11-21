/**
 * Métricas del motor para la interfaz: fps analizados, inferencia media y
 * fps de la cámara sobre una ventana deslizante, más la decisión de avisar
 * de una cámara lenta.
 *
 * Funciones puras sobre marcas de tiempo: sin DOM, sin React y sin reloj
 * propio (las marcas las pone quien llama).
 */

import type { PerformanceMetrics } from './types';

export type LowCameraFpsOptions = {
    /** Por debajo de esto se empieza a contar. */
    thresholdFps: number;
    /** Por encima de esto deja de avisar (histéresis). */
    recoverFps: number;
    /** Tiempo seguido por debajo del umbral antes de avisar. */
    sustainMs: number;
};

/**
 * Decide si avisar de que la cámara va lenta, sin parpadear: avisa tras
 * `sustainMs` seguidos por debajo de `thresholdFps` y deja de avisar al
 * superar `recoverFps`.
 */
export class LowCameraFpsDetector {
    private readonly options: LowCameraFpsOptions;
    private belowSince: number | null = null;
    private slow = false;

    constructor(options: LowCameraFpsOptions) {
        this.options = options;
    }

    update(cameraFps: number | null, now: number): boolean {
        if (cameraFps === null) {
            this.belowSince = null;

            return this.slow;
        }

        if (this.slow) {
            if (cameraFps >= this.options.recoverFps) {
                this.slow = false;
                this.belowSince = null;
            }

            return this.slow;
        }

        if (cameraFps >= this.options.thresholdFps) {
            this.belowSince = null;

            return false;
        }

        this.belowSince ??= now;
        this.slow = now - this.belowSince >= this.options.sustainMs;

        return this.slow;
    }

    reset(): void {
        this.belowSince = null;
        this.slow = false;
    }
}

export type EngineMetricsOptions = {
    windowMs: number;
    lowCameraFps: LowCameraFpsOptions;
};

export class EngineMetrics {
    private readonly windowMs: number;
    private readonly lowCamera: LowCameraFpsDetector;

    private cameraFrames: number[] = [];
    private cameraCounts: { at: number; total: number }[] = [];
    private results: { at: number; inferenceMs: number }[] = [];

    constructor(options: EngineMetricsOptions) {
        this.windowMs = options.windowMs;
        this.lowCamera = new LowCameraFpsDetector(options.lowCameraFps);
    }

    /** La cámara entregó una imagen nueva. */
    recordCameraFrame(at: number): void {
        this.cameraFrames.push(at);
    }

    /**
     * Total de imágenes que ha producido la pista de la cámara
     * (`MediaStreamTrack.stats.totalFrames`). Si el navegador lo da, es la
     * medida de fps de la cámara: no depende de que la página llegue a pintar
     * cada imagen (con el equipo saturado se saltan) y así el aviso de "falta
     * luz" no salta cuando el problema es la carga del equipo.
     */
    recordCameraFrameCount(at: number, total: number): void {
        const last = this.cameraCounts.at(-1);

        // La pista cambió (otra cámara): el contador empieza de nuevo.
        if (last !== undefined && total < last.total) {
            this.cameraCounts = [];
        }

        this.cameraCounts.push({ at, total });
    }

    /** El worker analizó un fotograma. */
    recordResult(at: number, inferenceMs: number): void {
        this.results.push({ at, inferenceMs });
    }

    /** Métricas de la ventana que termina en `now`. */
    snapshot(now: number): PerformanceMetrics {
        this.prune(now);

        const cameraFps =
            countRate(this.cameraCounts) ??
            rate(this.cameraFrames, now, this.windowMs);
        const fps = rate(
            this.results.map((result) => result.at),
            now,
            this.windowMs,
        );
        const inferenceMs =
            this.results.length === 0
                ? 0
                : this.results.reduce(
                      (sum, result) => sum + result.inferenceMs,
                      0,
                  ) / this.results.length;

        return {
            fps: fps === null ? 0 : Math.round(fps),
            inferenceMs: Math.round(inferenceMs),
            cameraFps: cameraFps === null ? null : Math.round(cameraFps),
            cameraSlow: this.lowCamera.update(cameraFps, now),
        };
    }

    reset(): void {
        this.cameraFrames = [];
        this.cameraCounts = [];
        this.results = [];
        this.lowCamera.reset();
    }

    private prune(now: number): void {
        const from = now - this.windowMs;

        this.cameraFrames = this.cameraFrames.filter((at) => at > from);
        this.cameraCounts = this.cameraCounts.filter(
            (sample) => sample.at > from,
        );
        this.results = this.results.filter((result) => result.at > from);
    }
}

/** True si dos snapshots se verían igual en la interfaz. */
export function sameMetrics(
    a: PerformanceMetrics | null,
    b: PerformanceMetrics | null,
): boolean {
    if (a === null || b === null) {
        return a === b;
    }

    return (
        a.fps === b.fps &&
        a.inferenceMs === b.inferenceMs &&
        a.cameraFps === b.cameraFps &&
        a.cameraSlow === b.cameraSlow
    );
}

/**
 * Eventos por segundo. Con menos de dos eventos no hay ritmo que medir. Se
 * mide entre el primero y el último para no infravalorar el ritmo mientras la
 * ventana aún se está llenando.
 */
function rate(
    timestamps: number[],
    now: number,
    windowMs: number,
): number | null {
    if (timestamps.length < 2) {
        return null;
    }

    const first = timestamps[0];
    const span = Math.min(now, timestamps[timestamps.length - 1]) - first;

    if (span <= 0) {
        return null;
    }

    return ((timestamps.length - 1) * 1000) / Math.min(span, windowMs);
}

/** Imágenes por segundo entre la primera y la última muestra del contador. */
function countRate(samples: { at: number; total: number }[]): number | null {
    if (samples.length < 2) {
        return null;
    }

    const first = samples[0];
    const last = samples[samples.length - 1];

    if (last.at <= first.at) {
        return null;
    }

    return ((last.total - first.total) * 1000) / (last.at - first.at);
}
