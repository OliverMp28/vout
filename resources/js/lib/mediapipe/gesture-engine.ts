/**
 * Motor de gestos sin React: una **sesión** de detección (una activación del
 * control facial) sobre un motor cargado prestado, con envío de fotogramas
 * con control de flujo, cursor por cabeza, vista de la cámara, métricas y
 * telemetría.
 *
 * `hooks/use-gesture-engine.ts` es un adaptador fino que traduce sus eventos
 * a estado de React. Aquí no hay estado de React a propósito: los callbacks
 * por fotograma (`onGesture`, `onHeadMove`…) corren de forma síncrona al
 * llegar cada resultado, y la interfaz solo se entera de lo que cambia poco
 * (estado, métricas, error).
 *
 * Flujo:
 *
 *   start() ─► RuntimeHost.acquire() ─► (READY) ─► SESSION_START
 *     ─► cámara (VideoFrameSource) ─► FramePump ─► FRAME
 *     ─► RESULT / FRAME_DROPPED ─► siguiente FRAME …
 *   stop()  ─► SESSION_END ─► el motor vuelve al host, en caliente
 *
 * Si el motor ya estaba cargado (`reuse: 'warm'`), la sesión empieza al
 * momento. El primer RESULT confirma que todo funciona: ahí el estado pasa de
 * `loading` a `running`. Un motor con error se descarta; si era uno
 * reutilizado y falla antes del primer RESULT (la GPU perdió el contexto
 * mientras esperaba, por ejemplo), se carga otro una vez sin avisar.
 *
 * Todo lo que toca el navegador (host del motor, reloj, captura, cámara,
 * tareas largas, lienzo de la vista) se puede inyectar, para probarlo sin
 * navegador.
 */

import {
    FRAME_RESPONSE_TIMEOUT_MS,
    LOW_CAMERA_FPS,
    LOW_CAMERA_FPS_RECOVER,
    LOW_CAMERA_FPS_SUSTAIN_MS,
    METRICS_EMIT_INTERVAL_MS,
    METRICS_WINDOW_MS,
    VIDEO_FRAME_CALLBACK_SILENCE_MS,
} from './constants';
import { EngineMetrics, sameMetrics } from './engine-metrics';
import type { RuntimeHost, RuntimeLease, RuntimeReuse } from './engine-runtime';
import { captureVideoFrame } from './frame-capture';
import { FramePump } from './frame-pump';
import type { FramePumpStats, FrameStamp } from './frame-pump';
import { HeadTracker } from './head-tracker';
import type { HeadTrackerConfig, HeadTrackPosition } from './head-tracker';
import { realScheduler } from './scheduler';
import type { Scheduler, TimerHandle } from './scheduler';
import type { TelemetryCollector } from './telemetry';
import type {
    AnalyzedFrame,
    CalibrationState,
    EngineInfo,
    EngineStatus,
    GestureEvent,
    HeadPose,
    NeutralBaseline,
    PerformanceMetrics,
    PreferredDelegate,
    PreviewOptions,
    PreviewSize,
    SessionOutMessage,
    WorkerConfig,
    WorkerInMessage,
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
    onCalibrationChange?: (state: CalibrationState) => void;
    /** Cada fotograma analizado, después de los callbacks anteriores. */
    onFrame?: (frame: AnalyzedFrame) => void;
};

/** Lo que el motor usa de la fuente de imágenes de la cámara. */
export type FrameSourceLike = {
    readonly mode: FrameSourceMode;
    start(): void;
    stop(): void;
};

/**
 * Dónde se dibuja la vista de la cámara (en el navegador,
 * `preview-surface.ts`). Un lienzo solo se puede ceder al worker una vez: cada
 * sesión pide uno nuevo.
 */
export type PreviewSurfaceLike = {
    /** Pone un lienzo nuevo en su sitio y lo cede, o null si no se puede. */
    createCanvas(): { canvas: OffscreenCanvas; size: PreviewSize } | null;
    /** Quita el lienzo de la página. */
    removeCanvas(): void;
    /** Avisa cuando cambia el tamaño del lienzo. Devuelve cómo dejar de oír. */
    onResize(listener: (size: PreviewSize) => void): () => void;
};

export type GestureEngineDiagnostics = {
    info: EngineInfo | null;
    /** Si la sesión encontró el motor ya cargado, o null sin sesión. */
    runtime: RuntimeReuse | null;
    frameSource: FrameSourceMode;
    frames: FramePumpStats;
};

export type GestureEngineOptions = {
    /** De dónde sale el motor cargado (`shared-runtime.ts` en la app). */
    runtimeHost: RuntimeHost;
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
    /** Delegado con que crear el landmarker (por defecto, GPU). */
    delegate?: PreferredDelegate;
    /**
     * Calibrar la cara neutra en cuanto el motor esté listo. Solo cuenta si
     * el usuario mira de frente con la cara relajada (`neutral-calibration.ts`).
     */
    autoCalibrate?: boolean;
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
    engineStartMs: 'engineStartMs',
    cameraOpenMs: 'cameraOpenMs',
    previewMs: 'previewMs',
} as const;

const NO_FRAMES: FramePumpStats = {
    sent: 0,
    completed: 0,
    skipped: 0,
};

/**
 * Las sesiones se numeran para toda la página: varios controladores pueden
 * usar el mismo motor, uno detrás de otro, y una respuesta tardía de la
 * sesión anterior no debe confundirse con la nueva.
 */
let nextSessionId = 1;

type PreviewAttachment = {
    surface: PreviewSurfaceLike;
    options: PreviewOptions;
    /** El worker tiene ahora un lienzo de esta vista. */
    attached: boolean;
    /** Deja de oír los cambios de tamaño del lienzo cedido. */
    stopResize: (() => void) | null;
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
    private calibration: CalibrationState = { status: 'idle' };
    private lastMetrics: PerformanceMetrics | null = null;

    /** El motor prestado mientras hay una activación en marcha. */
    private lease: RuntimeLease | null = null;
    /** La sesión abierta en el worker, o null mientras el motor se prepara. */
    private sessionId: number | null = null;
    /** Ya se cargó un motor nuevo tras fallar uno reutilizado. */
    private retriedWithFreshRuntime = false;
    /** Cuándo se pidió arrancar (para `engineStartMs`). */
    private startedAt: number | null = null;
    /** Calibración pedida antes de que la sesión empezara. */
    private calibrationPending = false;

    private pump: FramePump<ImageBitmap> | null = null;
    private frameSource: FrameSourceLike | null = null;
    private stopObservingLongTasks: (() => void) | null = null;
    private metricsTimer: TimerHandle | null = null;
    private preview: PreviewAttachment | null = null;

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

    /**
     * Pide el motor y, cuando esté listo, abre la sesión y mira la cámara.
     * No-op si ya hay una activación en marcha.
     */
    start(): void {
        if (this.lease !== null) {
            return;
        }

        this.emitError(null);
        this.setStatus('loading');
        this.startedAt = this.scheduler.now();
        this.retriedWithFreshRuntime = false;
        this.acquireRuntime();
    }

    /**
     * Cierra la sesión (cámara, gestos, calibración y vista) y vuelve a
     * `idle`. El motor queda cargado en el host para la siguiente.
     */
    stop(): void {
        this.teardown(false);
        this.headTracker.reset();
        this.emitError(null);
        this.setStatus('idle');
    }

    pause(): void {
        if (this.lease === null) {
            return;
        }

        this.frameSource?.stop();
        this.pump?.pause();
        this.postToSession({ type: 'PAUSE' });
        this.setStatus('paused');
    }

    resume(): void {
        if (this.lease === null) {
            return;
        }

        this.postToSession({ type: 'RESUME' });
        this.setStatus(this.firstResultReceived ? 'running' : 'loading');
        this.pump?.start();
        this.frameSource?.start();
    }

    /**
     * Toma la cara neutra de nuevo. Mientras dura (≈1 s si el usuario mira de
     * frente y relajado) no se detectan gestos; el cursor sigue a la cabeza.
     */
    calibrateNeutral(): void {
        this.startCalibration(false);
    }

    get calibrationState(): CalibrationState {
        return this.calibration;
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

    /**
     * Dibuja la vista de la cámara en `surface` mientras haya sesión (el
     * worker pinta en un lienzo cedido). Solo hay una vista: la última que
     * llega sustituye a la anterior.
     *
     * @returns La función que la quita.
     */
    attachPreview(
        surface: PreviewSurfaceLike,
        options: PreviewOptions,
    ): () => void {
        this.detachPreviewFromWorker();

        const attachment: PreviewAttachment = {
            surface,
            options,
            attached: false,
            stopResize: null,
        };

        this.preview = attachment;
        this.attachPreviewToWorker();

        return () => {
            if (this.preview !== attachment) {
                return;
            }

            this.detachPreviewFromWorker();
            this.preview = null;
        };
    }

    /** Cambia el modo o la malla de la vista actual. */
    updatePreview(options: PreviewOptions): void {
        if (this.preview === null) {
            return;
        }

        this.preview.options = options;

        if (this.preview.attached) {
            this.postToSession({ type: 'SET_PREVIEW', options });
        }
    }

    getDiagnostics(): GestureEngineDiagnostics {
        return {
            info: this.info,
            runtime: this.lease?.reuse ?? null,
            frameSource: this.frameSource?.mode ?? 'idle',
            frames: this.pump?.stats ?? { ...NO_FRAMES },
        };
    }

    // -----------------------------------------------------------------------
    // Motor y sesión
    // -----------------------------------------------------------------------

    private acquireRuntime(): void {
        const lease = this.options.runtimeHost.acquire(
            this.options.delegate ?? 'GPU',
        );

        this.lease = lease;

        lease.runtime.setListener({
            onReady: (info) => {
                if (this.lease === lease) {
                    this.beginSession(info);
                }
            },
            onMessage: (message) => {
                if (this.lease === lease) {
                    this.handleSessionMessage(message);
                }
            },
            onDead: (reason) => {
                if (this.lease === lease) {
                    this.handleRuntimeDeath(reason);
                }
            },
        });

        const { info } = lease.runtime;

        if (lease.runtime.state === 'ready' && info !== null) {
            this.beginSession(info);
        }
    }

    private handleRuntimeDeath(reason: string): void {
        // Un motor que esperaba en caliente puede haber perdido la GPU (el
        // equipo se suspendió, por ejemplo). Uno nuevo suele bastar.
        if (
            !this.firstResultReceived &&
            this.lease?.reuse !== 'cold' &&
            !this.retriedWithFreshRuntime
        ) {
            console.warn(
                '[GestureEngine] Reused engine failed before its first result; loading a fresh one:',
                reason,
            );
            this.retriedWithFreshRuntime = true;
            this.teardown(true);
            this.acquireRuntime();

            return;
        }

        this.fail(reason);
    }

    /** El motor está listo: se abre la sesión y se empieza a mirar la cámara. */
    private beginSession(info: EngineInfo): void {
        const lease = this.lease;

        if (lease === null || this.sessionId !== null) {
            return;
        }

        const sessionId = nextSessionId++;

        this.sessionId = sessionId;
        this.info = info;
        this.options.events.onInfo?.(info);

        lease.runtime.post({
            type: 'SESSION_START',
            sessionId,
            config: { ...this.config },
        });

        if (this.currentStatus === 'paused') {
            lease.runtime.post({ type: 'PAUSE' });
        }

        const captureFrame = this.options.captureFrame ?? captureVideoFrame;

        this.pump = new FramePump<ImageBitmap>({
            capture: () => captureFrame(this.options.getVideo()),
            send: (frameId, bitmap, timestamp) =>
                lease.runtime.post(
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

        // La automática al arrancar, o una que se pidió mientras cargaba.
        if (this.options.autoCalibrate && !this.calibrationPending) {
            this.setCalibration({ status: 'calibrating', automatic: true });
        }

        if (this.options.autoCalibrate || this.calibrationPending) {
            this.calibrationPending = false;
            this.postToSession({ type: 'CALIBRATE_NEUTRAL' });
        }

        this.attachPreviewToWorker();

        if (this.currentStatus !== 'paused') {
            this.pump.start();
            this.frameSource.start();
        }

        this.scheduleMetrics();
    }

    // -----------------------------------------------------------------------
    // Mensajes de la sesión
    // -----------------------------------------------------------------------

    private handleSessionMessage(message: SessionOutMessage): void {
        // Una respuesta tardía de una sesión anterior no cuenta.
        if (this.sessionId === null || message.sessionId !== this.sessionId) {
            return;
        }

        switch (message.type) {
            case 'RESULT':
                this.handleResult(message);
                break;

            case 'FRAME_DROPPED':
                this.pump?.complete(message.frameId);
                break;

            case 'CALIBRATED':
                this.setCalibration({
                    status: 'calibrated',
                    automatic: this.isAutomaticCalibration(),
                });
                this.options.events.onCalibrated?.(message.baseline);
                break;

            case 'CALIBRATION_FAILED':
                this.setCalibration({
                    status: 'failed',
                    automatic: this.isAutomaticCalibration(),
                    reason: message.reason,
                });
                break;
        }
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
        message: Extract<SessionOutMessage, { type: 'RESULT' }>,
    ): void {
        const receivedAt = this.scheduler.now();

        if (!this.firstResultReceived) {
            this.firstResultReceived = true;

            if (this.startedAt !== null) {
                this.options.telemetry.push(
                    TELEMETRY_KEYS.engineStartMs,
                    receivedAt - this.startedAt,
                );
            }

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

        events.onFrame?.({
            timestamp: message.timestamp,
            headPose: message.headPose,
            blendshapes: message.blendshapes,
            gestures: message.gestures,
        });

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
        message: Extract<SessionOutMessage, { type: 'RESULT' }>,
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

        if (message.previewMs !== null) {
            telemetry.push(TELEMETRY_KEYS.previewMs, message.previewMs);
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
    // Vista de la cámara
    // -----------------------------------------------------------------------

    /** Cede al worker un lienzo nuevo de la vista, si hay vista y sesión. */
    private attachPreviewToWorker(): void {
        const { preview, lease } = this;

        if (
            preview === null ||
            preview.attached ||
            lease === null ||
            this.sessionId === null
        ) {
            return;
        }

        const target = preview.surface.createCanvas();

        if (target === null) {
            return;
        }

        lease.runtime.post(
            {
                type: 'ATTACH_PREVIEW',
                canvas: target.canvas,
                size: target.size,
                options: preview.options,
            },
            [target.canvas],
        );

        preview.attached = true;
        preview.stopResize = preview.surface.onResize((size) =>
            this.postToSession({ type: 'RESIZE_PREVIEW', size }),
        );
    }

    /** El worker suelta el lienzo y se quita de la página. */
    private detachPreviewFromWorker(): void {
        const { preview } = this;

        if (preview === null || !preview.attached) {
            return;
        }

        preview.stopResize?.();
        preview.stopResize = null;
        preview.attached = false;
        this.lease?.runtime.post({ type: 'DETACH_PREVIEW' });
        preview.surface.removeCanvas();
    }

    // -----------------------------------------------------------------------
    // Ciclo de vida
    // -----------------------------------------------------------------------

    private fail(message: string): void {
        this.teardown(true);
        this.emitError(message);
        this.setStatus('error');
    }

    /**
     * Cierra la sesión y devuelve el motor: en caliente, o descartado si
     * falló (`discard`).
     */
    private teardown(discard: boolean): void {
        this.clearMetricsTimer();

        this.frameSource?.stop();
        this.frameSource = null;
        this.pump?.stop();
        this.pump = null;
        this.stopObservingLongTasks?.();
        this.stopObservingLongTasks = null;
        this.detachPreviewFromWorker();

        const lease = this.lease;

        this.lease = null;

        if (lease !== null) {
            if (this.sessionId !== null) {
                lease.runtime.post({
                    type: 'SESSION_END',
                    sessionId: this.sessionId,
                });
            }

            lease.release({ discard });
        }

        this.sessionId = null;
        this.calibrationPending = false;

        this.info = null;
        this.options.events.onInfo?.(null);

        if (this.calibration.status !== 'idle') {
            this.setCalibration({ status: 'idle' });
        }
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

            if (this.lease === null) {
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

    private startCalibration(automatic: boolean): void {
        if (this.lease === null) {
            return;
        }

        this.setCalibration({ status: 'calibrating', automatic });

        if (this.sessionId === null) {
            // El motor aún carga: se calibra en cuanto empiece la sesión.
            this.calibrationPending = true;

            return;
        }

        this.postToSession({ type: 'CALIBRATE_NEUTRAL' });
    }

    private isAutomaticCalibration(): boolean {
        return 'automatic' in this.calibration && this.calibration.automatic;
    }

    private setCalibration(state: CalibrationState): void {
        this.calibration = state;
        this.options.events.onCalibrationChange?.(state);
    }

    /** La sesión siguiente la recibe entera en `SESSION_START`. */
    private updateConfig(partial: Partial<WorkerConfig>): void {
        this.config = { ...this.config, ...partial };
        this.postToSession({ type: 'SET_CONFIG', config: partial });
    }

    /** Solo con la sesión abierta: antes, el worker no tiene a quién aplicarlo. */
    private postToSession(message: WorkerInMessage): void {
        if (this.sessionId !== null) {
            this.lease?.runtime.post(message);
        }
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

    private clearMetricsTimer(): void {
        if (this.metricsTimer !== null) {
            this.scheduler.clearTimeout(this.metricsTimer);
            this.metricsTimer = null;
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
