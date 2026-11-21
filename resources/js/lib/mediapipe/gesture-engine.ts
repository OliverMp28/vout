/**
 * Motor de gestos sin React: ciclo de vida del worker de detección, envío de
 * fotogramas con control de flujo, cursor por cabeza, métricas y telemetría.
 *
 * `hooks/use-gesture-engine.ts` es un adaptador fino que traduce sus eventos
 * a estado de React. Aquí no hay estado de React a propósito: los callbacks
 * por fotograma (`onGesture`, `onHeadMove`…) corren de forma síncrona al
 * llegar cada resultado, y la interfaz solo se entera de lo que cambia poco
 * (estado, métricas, error).
 *
 * Flujo:
 *
 *   start() ─► worker INIT ─► READY ─► cámara (VideoFrameSource) ─► FramePump
 *     ─► FRAME ─► RESULT / FRAME_DROPPED ─► siguiente FRAME …
 *
 * El primer RESULT confirma que los shaders están compilados: ahí el estado
 * pasa de `loading` a `running`.
 *
 * Todo lo que toca el navegador (worker, reloj, captura, cámara, tareas
 * largas) se puede inyectar, para probarlo sin navegador.
 */

import {
    ENGINE_INIT_TIMEOUT_MS,
    FRAME_RESPONSE_TIMEOUT_MS,
    LOW_CAMERA_FPS,
    LOW_CAMERA_FPS_RECOVER,
    LOW_CAMERA_FPS_SUSTAIN_MS,
    METRICS_EMIT_INTERVAL_MS,
    METRICS_WINDOW_MS,
    VIDEO_FRAME_CALLBACK_SILENCE_MS,
} from './constants';
import { EngineMetrics, sameMetrics } from './engine-metrics';
import { captureVideoFrame } from './frame-capture';
import { FramePump } from './frame-pump';
import type { FramePumpStats, FrameStamp } from './frame-pump';
import type { GestureWorkerHandle } from './gesture-worker-factory';
import { HeadTracker } from './head-tracker';
import type { HeadTrackerConfig, HeadTrackPosition } from './head-tracker';
import { realScheduler } from './scheduler';
import type { Scheduler, TimerHandle } from './scheduler';
import type { TelemetryCollector } from './telemetry';
import type {
    EngineInfo,
    EngineStatus,
    GestureEvent,
    HeadPose,
    MediaPipeRuntimeAssets,
    NeutralBaseline,
    PerformanceMetrics,
    WorkerConfig,
    WorkerInMessage,
    WorkerOutMessage,
} from './types';
import { VideoFrameSource } from './video-frame-source';
import type {
    FrameSourceMode,
    VideoFrameSourceOptions,
} from './video-frame-source';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type GestureEngineEvents = {
    onStatusChange?: (status: EngineStatus) => void;
    onError?: (message: string | null) => void;
    onInfo?: (info: EngineInfo | null) => void;
    onMetrics?: (metrics: PerformanceMetrics | null) => void;
    onGesture?: (event: GestureEvent) => void;
    onHeadPose?: (pose: HeadPose) => void;
    onHeadMove?: (position: HeadTrackPosition, frameTimestamp: number) => void;
    onBlendshapes?: (values: Record<string, number>) => void;
    onCalibrated?: (baseline: NeutralBaseline) => void;
};

/** Lo que el motor usa de la fuente de imágenes de la cámara. */
export type FrameSourceLike = {
    readonly mode: FrameSourceMode;
    start(): void;
    stop(): void;
};

export type GestureEngineDiagnostics = {
    info: EngineInfo | null;
    frameSource: FrameSourceMode;
    frames: FramePumpStats;
};

export type GestureEngineOptions = {
    createWorker: () => GestureWorkerHandle;
    /** Se resuelven al arrancar (necesitan `document.baseURI`). */
    resolveAssets: () => MediaPipeRuntimeAssets;
    mediapipeVersion: string;
    /** El `<video>` con la cámara. Se consulta en cada imagen. */
    getVideo: () => HTMLVideoElement | null;
    events: GestureEngineEvents;
    telemetry: TelemetryCollector;
    config: WorkerConfig;
    headTracker?: Partial<HeadTrackerConfig>;
    scheduler?: Scheduler;
    /** `performance.timeOrigin` de la página. */
    timeOrigin?: number;
    captureFrame?: (
        video: HTMLVideoElement | null,
    ) => Promise<ImageBitmap | null>;
    createFrameSource?: (options: VideoFrameSourceOptions) => FrameSourceLike;
    /**
     * Observa las tareas largas del hilo principal mientras el motor corre.
     * Devuelve la función que deja de observar.
     */
    observeLongTasks?: (onTask: (durationMs: number) => void) => () => void;
    /**
     * Imágenes que ha producido la cámara desde que se abrió, o null si el
     * navegador no lo da. Ver `EngineMetrics.recordCameraFrameCount`.
     */
    readCameraFrameCount?: (video: HTMLVideoElement | null) => number | null;
};

/** Nombres de las métricas de telemetría (overlay Ctrl+M y CSV de Vision Lab). */
export const TELEMETRY_KEYS = {
    cameraFps: 'cameraFps',
    processedFps: 'processedFps',
    cameraAgeMs: 'cameraAgeMs',
    captureMs: 'captureMs',
    queueMs: 'queueMs',
    inferenceMs: 'inferenceMs',
    returnMs: 'returnMs',
    pipelineMs: 'pipelineMs',
    cameraToResultMs: 'cameraToResultMs',
    mainHandlerMs: 'mainHandlerMs',
    mainLongTaskMs: 'mainLongTaskMs',
    gestureRiseMs: 'gestureRiseMs',
} as const;

const NO_FRAMES: FramePumpStats = {
    sent: 0,
    completed: 0,
    skipped: 0,
};

// ---------------------------------------------------------------------------
// Controlador
// ---------------------------------------------------------------------------

export class GestureEngineController {
    private readonly options: GestureEngineOptions;
    private readonly scheduler: Scheduler;
    private readonly timeOrigin: number;
    private readonly headTracker: HeadTracker;
    private readonly metrics = new EngineMetrics({
        windowMs: METRICS_WINDOW_MS,
        lowCameraFps: {
            thresholdFps: LOW_CAMERA_FPS,
            recoverFps: LOW_CAMERA_FPS_RECOVER,
            sustainMs: LOW_CAMERA_FPS_SUSTAIN_MS,
        },
    });

    private config: WorkerConfig;
    private currentStatus: EngineStatus = 'idle';
    private info: EngineInfo | null = null;
    private lastMetrics: PerformanceMetrics | null = null;

    private handle: GestureWorkerHandle | null = null;
    private pump: FramePump<ImageBitmap> | null = null;
    private frameSource: FrameSourceLike | null = null;
    private stopObservingLongTasks: (() => void) | null = null;

    private initTimer: TimerHandle | null = null;
    private metricsTimer: TimerHandle | null = null;

    private lastRawHead = { horizontal: 0, vertical: 0 };
    private lastCameraFrameAt: number | null = null;
    private lastResultAt: number | null = null;
    /** El primer RESULT confirma que el motor está listo (shaders compilados). */
    private firstResultReceived = false;

    constructor(options: GestureEngineOptions) {
        this.options = options;
        this.scheduler = options.scheduler ?? realScheduler;
        this.timeOrigin = options.timeOrigin ?? performance.timeOrigin;
        this.config = { ...options.config };
        this.headTracker = new HeadTracker(options.headTracker);
    }

    get status(): EngineStatus {
        return this.currentStatus;
    }

    /** Arranca el worker y, cuando esté listo, la cámara. No-op si ya corre. */
    start(): void {
        if (this.handle !== null) {
            return;
        }

        this.emitError(null);
        this.setStatus('loading');

        const handle = this.options.createWorker();
        const worker = handle.worker;

        this.handle = handle;

        worker.onmessage = (event) => {
            if (this.handle === handle) {
                this.handleMessage(event.data);
            }
        };
        worker.onerror = (event) => {
            if (this.handle === handle) {
                console.error(
                    '[GestureEngine] Worker uncaught error:',
                    event.message,
                );
                this.fail(
                    event.message || 'Worker encountered an unexpected error',
                );
            }
        };

        this.post({
            type: 'INIT',
            assets: this.options.resolveAssets(),
            mediapipeVersion: this.options.mediapipeVersion,
            config: { ...this.config },
        });

        this.initTimer = this.scheduler.setTimeout(() => {
            this.initTimer = null;

            if (this.handle === handle && this.info === null) {
                console.error(
                    '[GestureEngine] Init timeout — READY not received within',
                    ENGINE_INIT_TIMEOUT_MS,
                    'ms',
                );
                this.fail(
                    'Gesture engine timed out during initialization. Check browser console for details.',
                );
            }
        }, ENGINE_INIT_TIMEOUT_MS);
    }

    /** Detiene todo y vuelve a `idle`. */
    stop(): void {
        this.teardown();
        this.headTracker.reset();
        this.emitError(null);
        this.setStatus('idle');
    }

    pause(): void {
        if (this.handle === null) {
            return;
        }

        this.frameSource?.stop();
        this.pump?.pause();
        this.post({ type: 'PAUSE' });
        this.setStatus('paused');
    }

    resume(): void {
        if (this.handle === null) {
            return;
        }

        this.post({ type: 'RESUME' });
        this.setStatus(this.firstResultReceived ? 'running' : 'loading');
        this.pump?.start();
        this.frameSource?.start();
    }

    calibrateNeutral(): void {
        this.post({ type: 'CALIBRATE_NEUTRAL' });
    }

    /**
     * Recentra el cursor: la orientación actual de la cabeza pasa a apuntar a
     * (`targetX`, `targetY`) del viewport, en [0, 1].
     */
    recenter(targetX?: number, targetY?: number): void {
        this.headTracker.recenter(
            this.lastRawHead.horizontal,
            this.lastRawHead.vertical,
            targetX,
            targetY,
        );
    }

    setSensitivity(sensitivity: number): void {
        this.updateConfig({ sensitivity });
    }

    setEnableBlendshapes(enableBlendshapes: boolean): void {
        this.updateConfig({ enableBlendshapes });
    }

    setHeadTrackerConfig(config: Partial<HeadTrackerConfig>): void {
        this.headTracker.setConfig(config);
    }

    getDiagnostics(): GestureEngineDiagnostics {
        return {
            info: this.info,
            frameSource: this.frameSource?.mode ?? 'idle',
            frames: this.pump?.stats ?? { ...NO_FRAMES },
        };
    }

    // -----------------------------------------------------------------------
    // Mensajes del worker
    // -----------------------------------------------------------------------

    private handleMessage(message: WorkerOutMessage): void {
        switch (message.type) {
            case 'READY':
                this.handleReady(message.info);
                break;

            case 'RESULT':
                this.handleResult(message);
                break;

            case 'FRAME_DROPPED':
                this.pump?.complete(message.frameId);
                break;

            case 'CALIBRATED':
                this.options.events.onCalibrated?.(message.baseline);
                break;

            case 'ERROR':
                this.fail(message.message);
                break;
        }
    }

    private handleReady(info: EngineInfo): void {
        this.clearTimer('initTimer');
        this.info = info;
        this.options.events.onInfo?.(info);

        const worker = this.handle?.worker;

        if (worker === undefined) {
            return;
        }

        const captureFrame = this.options.captureFrame ?? captureVideoFrame;

        this.pump = new FramePump<ImageBitmap>({
            capture: () => captureFrame(this.options.getVideo()),
            send: (frameId, bitmap, timestamp) =>
                worker.postMessage(
                    { type: 'FRAME', frameId, bitmap, timestamp },
                    [bitmap],
                ),
            discard: (bitmap) => bitmap.close(),
            scheduler: this.scheduler,
            responseTimeoutMs: FRAME_RESPONSE_TIMEOUT_MS,
            onResponseTimeout: () =>
                this.fail(
                    'Gesture engine stopped responding. Check browser console for details.',
                ),
        });

        this.frameSource = (
            this.options.createFrameSource ?? defaultFrameSource
        )({
            getVideo: () => this.options.getVideo(),
            onFrame: (stamp) => this.handleCameraFrame(stamp),
            scheduler: this.scheduler,
            requestAnimationFrame: (callback) =>
                globalThis.requestAnimationFrame(callback),
            cancelAnimationFrame: (handle) =>
                globalThis.cancelAnimationFrame(handle),
            silenceTimeoutMs: VIDEO_FRAME_CALLBACK_SILENCE_MS,
        });

        this.stopObservingLongTasks = (
            this.options.observeLongTasks ?? observeLongTasks
        )((durationMs) =>
            this.options.telemetry.push(
                TELEMETRY_KEYS.mainLongTaskMs,
                durationMs,
            ),
        );

        if (this.currentStatus !== 'paused') {
            this.pump.start();
            this.frameSource.start();
        }

        this.scheduleMetrics();
    }

    private handleCameraFrame(stamp: FrameStamp): void {
        const now = this.scheduler.now();

        this.metrics.recordCameraFrame(now);

        if (this.lastCameraFrameAt !== null && now > this.lastCameraFrameAt) {
            this.options.telemetry.push(
                TELEMETRY_KEYS.cameraFps,
                1000 / (now - this.lastCameraFrameAt),
            );
        }

        this.lastCameraFrameAt = now;
        this.pump?.notifyFrame(stamp);
    }

    private handleResult(
        message: Extract<WorkerOutMessage, { type: 'RESULT' }>,
    ): void {
        const receivedAt = this.scheduler.now();

        if (!this.firstResultReceived) {
            this.firstResultReceived = true;

            if (this.currentStatus === 'loading') {
                this.setStatus('running');
            }
        }

        const { events } = this.options;

        for (const gesture of message.gestures) {
            events.onGesture?.(gesture);
        }

        if (message.headPose !== null) {
            const pose = message.headPose;

            events.onHeadPose?.(pose);

            // Negaciones verificadas empíricamente — ver HeadTracker.update().
            this.lastRawHead = {
                horizontal: -pose.pitch,
                vertical: -pose.roll,
            };

            const position = this.headTracker.update(
                this.lastRawHead.horizontal,
                this.lastRawHead.vertical,
            );

            events.onHeadMove?.(position, pose.timestamp);
        }

        if (message.blendshapes !== null) {
            events.onBlendshapes?.(message.blendshapes);
        }

        this.options.telemetry.push(
            TELEMETRY_KEYS.mainHandlerMs,
            this.scheduler.now() - receivedAt,
        );

        // Después de entregar los gestos: liberar la bomba arranca ya la
        // captura del siguiente fotograma, y el juego va primero.
        this.recordTimings(message, receivedAt);
    }

    /** Latencia por etapas del fotograma que acaba de volver. */
    private recordTimings(
        message: Extract<WorkerOutMessage, { type: 'RESULT' }>,
        receivedAt: number,
    ): void {
        const { telemetry } = this.options;
        const { timing } = message;
        const inferenceMs = timing.inferenceEnd - timing.inferenceStart;
        const frame = this.pump?.complete(message.frameId) ?? null;

        telemetry.push(TELEMETRY_KEYS.inferenceMs, inferenceMs);
        this.metrics.recordResult(receivedAt, inferenceMs);

        for (const riseMs of message.gestureRiseMs) {
            telemetry.push(TELEMETRY_KEYS.gestureRiseMs, riseMs);
        }

        if (this.lastResultAt !== null && receivedAt > this.lastResultAt) {
            telemetry.push(
                TELEMETRY_KEYS.processedFps,
                1000 / (receivedAt - this.lastResultAt),
            );
        }

        this.lastResultAt = receivedAt;

        // Respuesta que no corresponde al fotograma en vuelo: sus gestos sí
        // cuentan (arriba), sus tiempos no.
        if (frame === null) {
            return;
        }

        const toLocal = (epochMs: number) => epochMs - this.timeOrigin;
        const positive = (ms: number) => Math.max(0, ms);

        telemetry.push(
            TELEMETRY_KEYS.captureMs,
            positive(frame.sentAt - frame.captureStartedAt),
        );
        telemetry.push(
            TELEMETRY_KEYS.queueMs,
            positive(toLocal(timing.receivedAt) - frame.sentAt),
        );
        telemetry.push(
            TELEMETRY_KEYS.returnMs,
            positive(receivedAt - toLocal(timing.postedAt)),
        );
        telemetry.push(
            TELEMETRY_KEYS.pipelineMs,
            positive(receivedAt - frame.captureStartedAt),
        );

        const { captureTime } = frame.stamp;

        if (captureTime !== null) {
            telemetry.push(
                TELEMETRY_KEYS.cameraAgeMs,
                positive(frame.captureStartedAt - captureTime),
            );
            telemetry.push(
                TELEMETRY_KEYS.cameraToResultMs,
                positive(receivedAt - captureTime),
            );
        }
    }

    // -----------------------------------------------------------------------
    // Ciclo de vida
    // -----------------------------------------------------------------------

    private fail(message: string): void {
        this.teardown();
        this.emitError(message);
        this.setStatus('error');
    }

    private teardown(): void {
        this.clearTimer('initTimer');
        this.clearTimer('metricsTimer');

        this.frameSource?.stop();
        this.frameSource = null;
        this.pump?.stop();
        this.pump = null;
        this.stopObservingLongTasks?.();
        this.stopObservingLongTasks = null;

        const handle = this.handle;

        this.handle = null;

        if (handle !== null) {
            handle.worker.onmessage = null;
            handle.worker.onerror = null;
            handle.worker.postMessage({ type: 'DESTROY' });
            handle.worker.terminate();
            handle.dispose();
        }

        this.info = null;
        this.options.events.onInfo?.(null);
        this.metrics.reset();
        this.lastMetrics = null;
        this.options.events.onMetrics?.(null);
        this.lastCameraFrameAt = null;
        this.lastResultAt = null;
        this.firstResultReceived = false;
    }

    private scheduleMetrics(): void {
        this.metricsTimer = this.scheduler.setTimeout(() => {
            this.metricsTimer = null;

            if (this.handle === null) {
                return;
            }

            const now = this.scheduler.now();
            const cameraFrames = (
                this.options.readCameraFrameCount ?? readCameraFrameCount
            )(this.options.getVideo());

            if (cameraFrames !== null) {
                this.metrics.recordCameraFrameCount(now, cameraFrames);
            }

            const snapshot = this.metrics.snapshot(now);

            if (!sameMetrics(this.lastMetrics, snapshot)) {
                this.lastMetrics = snapshot;
                this.options.events.onMetrics?.(snapshot);
            }

            this.scheduleMetrics();
        }, METRICS_EMIT_INTERVAL_MS);
    }

    private updateConfig(partial: Partial<WorkerConfig>): void {
        this.config = { ...this.config, ...partial };
        this.post({ type: 'SET_CONFIG', config: partial });
    }

    private post(message: WorkerInMessage): void {
        this.handle?.worker.postMessage(message);
    }

    private setStatus(status: EngineStatus): void {
        if (status === this.currentStatus) {
            return;
        }

        this.currentStatus = status;
        this.options.events.onStatusChange?.(status);
    }

    private emitError(message: string | null): void {
        this.options.events.onError?.(message);
    }

    private clearTimer(name: 'initTimer' | 'metricsTimer'): void {
        const timer = this[name];

        if (timer !== null) {
            this.scheduler.clearTimeout(timer);
            this[name] = null;
        }
    }
}

// ---------------------------------------------------------------------------
// Implementaciones por defecto (navegador)
// ---------------------------------------------------------------------------

function defaultFrameSource(options: VideoFrameSourceOptions): FrameSourceLike {
    return new VideoFrameSource(options);
}

/** `MediaStreamTrack.stats` de vídeo (Chromium), aún sin tipos en lib.dom. */
type TrackWithStats = MediaStreamTrack & { stats?: { totalFrames?: number } };

/** Imágenes producidas por la pista de vídeo del `<video>`, si se sabe. */
function readCameraFrameCount(video: HTMLVideoElement | null): number | null {
    const stream = video?.srcObject;

    if (
        typeof MediaStream === 'undefined' ||
        !(stream instanceof MediaStream)
    ) {
        return null;
    }

    const track = stream.getVideoTracks()[0] as TrackWithStats | undefined;
    const total = track?.stats?.totalFrames;

    return typeof total === 'number' && Number.isFinite(total) ? total : null;
}

/** Tareas largas (>50 ms) del hilo principal, donde el navegador lo permite. */
function observeLongTasks(onTask: (durationMs: number) => void): () => void {
    if (
        typeof PerformanceObserver === 'undefined' ||
        !PerformanceObserver.supportedEntryTypes?.includes('longtask')
    ) {
        return () => {};
    }

    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            onTask(entry.duration);
        }
    });

    observer.observe({ type: 'longtask' });

    return () => observer.disconnect();
}
