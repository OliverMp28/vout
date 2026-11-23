import { beforeEach, describe, expect, spyOn, test } from 'bun:test';

import type { FrameStamp } from '@/lib/mediapipe/frame-pump';
import {
    GestureEngineController,
    TELEMETRY_KEYS,
} from '@/lib/mediapipe/gesture-engine';
import type {
    FrameSourceLike,
    GestureEngineEvents,
    GestureEngineOptions,
    PreviewSurfaceLike,
} from '@/lib/mediapipe/gesture-engine';
import { TelemetryCollector } from '@/lib/mediapipe/telemetry';
import { GestureType } from '@/lib/mediapipe/types';
import type {
    EngineStatus,
    PreviewOptions,
    PreviewSize,
    SessionOutMessage,
} from '@/lib/mediapipe/types';

import { READY, TEST_ASSETS, createTestHost } from '../support/fake-worker';
import { ManualScheduler, flushPromises } from '../support/manual-scheduler';

const TIME_ORIGIN = 1_000_000;

class FakeFrameSource implements FrameSourceLike {
    mode: FrameSourceLike['mode'] = 'idle';
    private key = 0;

    constructor(private readonly onFrame: (stamp: FrameStamp) => void) {}

    start(): void {
        this.mode = 'video-frame-callback';
    }

    stop(): void {
        this.mode = 'idle';
    }

    /** La cámara entrega una imagen. */
    emit(captureTime: number | null = null): void {
        this.key++;
        this.onFrame({ key: this.key, captureTime });
    }
}

/** Lienzo de la vista falso: cuenta los que crea y los que quita. */
class FakePreviewSurface implements PreviewSurfaceLike {
    created: OffscreenCanvas[] = [];
    removed = 0;
    private resizeListener: ((size: PreviewSize) => void) | null = null;

    constructor(private readonly size: PreviewSize | null = SIZE) {}

    createCanvas() {
        if (this.size === null) {
            return null;
        }

        const canvas = {
            id: this.created.length,
        } as unknown as OffscreenCanvas;

        this.created.push(canvas);

        return { canvas, size: this.size };
    }

    removeCanvas(): void {
        this.removed++;
    }

    onResize(listener: (size: PreviewSize) => void): () => void {
        this.resizeListener = listener;

        return () => {
            this.resizeListener = null;
        };
    }

    /** El contenedor cambia de tamaño. */
    resize(size: PreviewSize): void {
        this.resizeListener?.(size);
    }

    get listening(): boolean {
        return this.resizeListener !== null;
    }
}

const SIZE: PreviewSize = { width: 640, height: 480, pixelRatio: 2 };

const PREVIEW: PreviewOptions = {
    mode: 'synced',
    mesh: 'contours',
    colors: { mesh: 'white', contour: 'violet' },
};

function setup(
    events: GestureEngineEvents = {},
    overrides: Partial<GestureEngineOptions> = {},
) {
    const scheduler = new ManualScheduler();
    const telemetry = new TelemetryCollector();
    const fixture = createTestHost(scheduler);
    const sources: FakeFrameSource[] = [];
    const statuses: EngineStatus[] = [];
    const errors: (string | null)[] = [];

    const engine = new GestureEngineController({
        runtimeHost: fixture.host,
        getVideo: () => ({}) as HTMLVideoElement,
        telemetry,
        config: { sensitivity: 5, enableBlendshapes: false },
        scheduler,
        timeOrigin: TIME_ORIGIN,
        captureFrame: () =>
            Promise.resolve({ close: () => {} } as unknown as ImageBitmap),
        createFrameSource: (options) => {
            const source = new FakeFrameSource(options.onFrame);
            sources.push(source);

            return source;
        },
        observeLongTasks: () => () => {},
        ...overrides,
        events: {
            onStatusChange: (status) => statuses.push(status),
            onError: (message) => errors.push(message),
            ...events,
        },
    });

    const worker = fixture.worker;
    const source = () => sources[sources.length - 1];

    /** Respuesta del worker al último FRAME, con tiempos coherentes. */
    const replyToLastFrame = (
        overrides: Partial<Extract<SessionOutMessage, { type: 'RESULT' }>> = {},
    ) => {
        const frame = worker().frames().at(-1)!;
        const now = TIME_ORIGIN + scheduler.now();

        worker().reply({
            type: 'RESULT',
            sessionId: worker().sessionId(),
            frameId: frame.frameId,
            timestamp: 0,
            gestures: [],
            headPose: null,
            blendshapes: null,
            gestureRiseMs: [],
            timing: {
                receivedAt: now - 20,
                inferenceStart: now - 19,
                inferenceEnd: now - 4,
                postedAt: now - 3,
            },
            previewMs: null,
            ...overrides,
        });
    };

    const startAndBecomeReady = async () => {
        engine.start();
        worker().reply(READY);
        source().emit();
        await flushPromises();
    };

    return {
        engine,
        scheduler,
        telemetry,
        statuses,
        errors,
        host: fixture.host,
        worker,
        workers: fixture.workers,
        source,
        replyToLastFrame,
        startAndBecomeReady,
        get disposed() {
            return fixture.disposed;
        },
    };
}

describe('GestureEngineController', () => {
    beforeEach(() => {
        // Los fallos simulados se registran en consola; aquí sobran.
        spyOn(console, 'error').mockImplementation(() => {});
    });

    test('carga el motor con las URLs locales y abre la sesión con la configuración', () => {
        const { engine, worker, statuses } = setup();

        engine.start();

        expect(statuses).toEqual(['loading']);
        expect(worker().posted[0].message).toEqual({
            type: 'INIT',
            assets: TEST_ASSETS,
            mediapipeVersion: '0.10.35',
            delegate: 'GPU',
        });
        expect(worker().types()).not.toContain('SESSION_START');

        worker().reply(READY);

        expect(worker().messages('SESSION_START')).toEqual([
            {
                type: 'SESSION_START',
                sessionId: worker().sessionId(),
                config: { sensitivity: 5, enableBlendshapes: false },
            },
        ]);
    });

    test('con READY empieza a mirar la cámara y envía fotogramas transferidos', async () => {
        const { worker, source, startAndBecomeReady } = setup();

        await startAndBecomeReady();

        expect(source().mode).toBe('video-frame-callback');

        const [frame] = worker().frames();

        expect(frame).toMatchObject({ type: 'FRAME', frameId: 1 });
        expect(worker().posted.at(-1)?.transfer).toEqual([frame.bitmap]);
    });

    test('pasa a running con el primer resultado, no con READY', async () => {
        const { engine, statuses, replyToLastFrame, startAndBecomeReady } =
            setup();

        await startAndBecomeReady();
        expect(engine.status).toBe('loading');

        replyToLastFrame();

        expect(statuses).toEqual(['loading', 'running']);
    });

    test('reparte gestos, pose y cursor de cada resultado', async () => {
        const gestures: string[] = [];
        const poses: number[] = [];
        const moves: number[] = [];
        const { replyToLastFrame, startAndBecomeReady } = setup({
            onGesture: (event) =>
                gestures.push(`${event.gesture}:${event.phase}`),
            onHeadPose: (pose) => poses.push(pose.timestamp),
            onHeadMove: (_position, timestamp) => moves.push(timestamp),
        });

        await startAndBecomeReady();
        replyToLastFrame({
            gestures: [
                {
                    gesture: GestureType.MouthOpen,
                    confidence: 0.9,
                    timestamp: 10,
                    phase: 'start',
                },
            ],
            headPose: { yaw: 0, pitch: 0.2, roll: -0.1, timestamp: 10 },
        });

        expect(gestures).toEqual(['MOUTH_OPEN:start']);
        expect(poses).toEqual([10]);
        expect(moves).toEqual([10]);
    });

    test('no envía otro fotograma hasta que el worker responde', async () => {
        const { worker, source, replyToLastFrame, startAndBecomeReady } =
            setup();

        await startAndBecomeReady();
        source().emit();
        source().emit();
        await flushPromises();

        expect(worker().frames()).toHaveLength(1);

        replyToLastFrame();
        await flushPromises();

        expect(worker().frames()).toHaveLength(2);
    });

    test('FRAME_DROPPED también libera el siguiente fotograma', async () => {
        const { worker, source, startAndBecomeReady } = setup();

        await startAndBecomeReady();
        source().emit();
        worker().reply({
            type: 'FRAME_DROPPED',
            sessionId: worker().sessionId(),
            frameId: worker().frames()[0].frameId,
            reason: 'error',
        });
        await flushPromises();

        expect(worker().frames()).toHaveLength(2);
    });

    test('mide la latencia por etapas', async () => {
        const { telemetry, scheduler, source, worker, startAndBecomeReady } =
            setup();

        await startAndBecomeReady();

        // Primer fotograma: capturado en t=0. Respuesta en t=50.
        scheduler.advance(50);
        const frame = worker().frames()[0];
        const now = TIME_ORIGIN + 50;

        worker().reply({
            type: 'RESULT',
            sessionId: worker().sessionId(),
            frameId: frame.frameId,
            timestamp: 0,
            gestures: [],
            headPose: null,
            blendshapes: null,
            gestureRiseMs: [40],
            timing: {
                receivedAt: TIME_ORIGIN + 2,
                inferenceStart: TIME_ORIGIN + 3,
                inferenceEnd: TIME_ORIGIN + 45,
                postedAt: now - 1,
            },
            previewMs: null,
        });

        // Segundo, con hora de captura de la cámara (20 ms antes).
        scheduler.advance(10);
        source().emit(scheduler.now() - 20);
        await flushPromises();

        const second = worker().frames()[1];

        scheduler.advance(40);
        worker().reply({
            type: 'RESULT',
            sessionId: worker().sessionId(),
            frameId: second.frameId,
            timestamp: 60,
            gestures: [],
            headPose: null,
            blendshapes: null,
            gestureRiseMs: [],
            timing: {
                receivedAt: TIME_ORIGIN + 61,
                inferenceStart: TIME_ORIGIN + 61,
                inferenceEnd: TIME_ORIGIN + 95,
                postedAt: TIME_ORIGIN + 99,
            },
            previewMs: null,
        });

        const stats = telemetry.snapshot();

        expect(stats[TELEMETRY_KEYS.inferenceMs].max).toBe(42);
        expect(stats[TELEMETRY_KEYS.queueMs].max).toBe(2);
        expect(stats[TELEMETRY_KEYS.returnMs].min).toBe(1);
        expect(stats[TELEMETRY_KEYS.pipelineMs].max).toBe(50);
        expect(stats[TELEMETRY_KEYS.gestureRiseMs].max).toBe(40);
        expect(stats[TELEMETRY_KEYS.cameraAgeMs].max).toBe(20);
        expect(stats[TELEMETRY_KEYS.cameraToResultMs].max).toBe(60);
        expect(stats[TELEMETRY_KEYS.processedFps].max).toBe(20);
        expect(stats[TELEMETRY_KEYS.mainHandlerMs]).toBeDefined();
        // De start() (t=0) al primer resultado (t=50).
        expect(stats[TELEMETRY_KEYS.engineStartMs]).toMatchObject({
            count: 1,
            max: 50,
        });
    });

    test('un resultado que no es del fotograma en vuelo entrega sus gestos igualmente', async () => {
        const gestures: string[] = [];
        const { worker, replyToLastFrame, startAndBecomeReady } = setup({
            onGesture: (event) => gestures.push(event.phase),
        });

        await startAndBecomeReady();
        replyToLastFrame({
            frameId: 999,
            gestures: [
                {
                    gesture: GestureType.MouthOpen,
                    confidence: 0.9,
                    timestamp: 0,
                    phase: 'end',
                },
            ],
        });

        expect(gestures).toEqual(['end']);
        expect(worker().frames()).toHaveLength(1);
    });

    test('si el worker deja de responder a un fotograma, el motor falla', async () => {
        const { engine, scheduler, worker, errors, startAndBecomeReady } =
            setup();

        await startAndBecomeReady();
        scheduler.advance(15_000);

        expect(engine.status).toBe('error');
        expect(errors.at(-1)).toContain('stopped responding');
        expect(worker().terminated).toBe(true);
    });

    test('emite métricas cada medio segundo solo si cambian', async () => {
        const emitted: unknown[] = [];
        const { scheduler, source, replyToLastFrame, startAndBecomeReady } =
            setup({ onMetrics: (metrics) => emitted.push(metrics) });

        await startAndBecomeReady();

        for (let i = 0; i < 30; i++) {
            scheduler.advance(33);
            replyToLastFrame();
            source().emit();
            await flushPromises();
        }

        expect(emitted.at(-1)).toMatchObject({ fps: 30, cameraFps: 30 });

        // Sin imágenes nuevas la ventana se vacía…
        scheduler.advance(3000);
        expect(emitted.at(-1)).toMatchObject({ fps: 0, cameraFps: null });

        // …y, ya estable, no se vuelve a emitir lo mismo.
        const settled = emitted.length;
        scheduler.advance(2000);

        expect(emitted).toHaveLength(settled);
    });

    test('si el worker no avisa de que está listo, falla y lo cierra', () => {
        const { engine, scheduler, worker, statuses, errors } = setup();

        engine.start();
        scheduler.advance(30_000);

        expect(statuses.at(-1)).toBe('error');
        expect(errors.at(-1)).toContain('timed out');
        expect(worker().terminated).toBe(true);
    });

    test('un ERROR del worker lo cierra y permite reintentar', async () => {
        const { engine, worker, workers, statuses, startAndBecomeReady } =
            setup();

        await startAndBecomeReady();
        worker().reply({ type: 'ERROR', code: 'INIT_FAILED', message: 'boom' });

        expect(statuses.at(-1)).toBe('error');
        expect(workers[0].terminated).toBe(true);

        engine.start();

        expect(workers).toHaveLength(2);
        expect(statuses.at(-1)).toBe('loading');
    });

    test('un error no capturado del worker también falla', () => {
        const { engine, worker, errors } = setup();

        engine.start();
        worker().onerror?.({ message: 'kaput' } as ErrorEvent);

        expect(engine.status).toBe('error');
        expect(errors.at(-1)).toBe('kaput');
    });

    test('stop cierra la sesión, la cámara y las métricas, pero deja el motor cargado', async () => {
        const metrics: unknown[] = [];
        const setupResult = setup({
            onMetrics: (value) => metrics.push(value),
        });
        const { engine, host, worker, source, startAndBecomeReady } =
            setupResult;

        await startAndBecomeReady();
        const sessionId = worker().sessionId();
        engine.stop();

        expect(worker().posted.at(-1)?.message).toEqual({
            type: 'SESSION_END',
            sessionId,
        });
        expect(worker().terminated).toBe(false);
        expect(setupResult.disposed).toBe(0);
        expect(host.warmState).toBe('ready');
        expect(source().mode).toBe('idle');
        expect(engine.status).toBe('idle');
        expect(metrics.at(-1)).toBeNull();
    });

    test('reactivar reutiliza el motor cargado con una sesión nueva', async () => {
        const {
            engine,
            statuses,
            worker,
            workers,
            replyToLastFrame,
            startAndBecomeReady,
            source,
        } = setup();

        await startAndBecomeReady();
        replyToLastFrame();
        const firstSession = worker().sessionId();
        engine.stop();

        engine.start();

        // Sin INIT ni esperar a READY: la sesión empieza al momento.
        expect(workers).toHaveLength(1);
        expect(worker().messages('INIT')).toHaveLength(1);
        expect(worker().sessionId()).toBeGreaterThan(firstSession);
        expect(engine.getDiagnostics().runtime).toBe('warm');
        expect(engine.status).toBe('loading');

        source().emit();
        await flushPromises();
        replyToLastFrame();

        expect(statuses.slice(-2)).toEqual(['loading', 'running']);
    });

    test('una respuesta tardía de la sesión anterior no dispara gestos', async () => {
        const gestures: string[] = [];
        const { engine, worker, replyToLastFrame, startAndBecomeReady } = setup(
            { onGesture: (event) => gestures.push(event.phase) },
        );

        await startAndBecomeReady();
        const oldSession = worker().sessionId();
        engine.stop();
        engine.start();

        replyToLastFrame({
            sessionId: oldSession,
            gestures: [
                {
                    gesture: GestureType.MouthOpen,
                    confidence: 0.9,
                    timestamp: 0,
                    phase: 'start',
                },
            ],
        });
        worker().reply({
            type: 'CALIBRATED',
            sessionId: oldSession,
            baseline: { capturedAt: 1, blendshapes: {} },
        });

        expect(gestures).toEqual([]);
        expect(engine.status).toBe('loading');
        expect(engine.calibrationState).toEqual({ status: 'idle' });
    });

    test('si un motor reutilizado falla antes del primer resultado, carga otro sin avisar', () => {
        const { engine, host, workers, errors, worker, statuses } = setup();

        host.prewarm();
        workers[0].reply(READY);
        engine.start();

        workers[0].reply({
            type: 'ERROR',
            code: 'INFERENCE_FAILED',
            message: 'context lost',
        });

        expect(workers).toHaveLength(2);
        expect(workers[0].terminated).toBe(true);
        expect(engine.status).toBe('loading');
        expect(errors.filter((error) => error !== null)).toEqual([]);
        expect(engine.getDiagnostics().runtime).toBe('cold');

        // El nuevo también falla: ahora sí es un error.
        worker().reply({ type: 'ERROR', code: 'INIT_FAILED', message: 'boom' });

        expect(statuses.at(-1)).toBe('error');
        expect(errors.at(-1)).toBe('boom');
    });

    test('si un motor reutilizado falla después de funcionar, es un error', async () => {
        const { engine, host, workers, errors, replyToLastFrame, source } =
            setup();

        host.prewarm();
        workers[0].reply(READY);
        engine.start();
        source().emit();
        await flushPromises();
        replyToLastFrame();

        workers[0].reply({
            type: 'ERROR',
            code: 'INFERENCE_FAILED',
            message: 'gpu gone',
        });

        expect(workers).toHaveLength(1);
        expect(engine.status).toBe('error');
        expect(errors.at(-1)).toBe('gpu gone');
    });

    test('pausa y reanuda', async () => {
        const {
            engine,
            worker,
            source,
            replyToLastFrame,
            startAndBecomeReady,
        } = setup();

        await startAndBecomeReady();
        replyToLastFrame();

        engine.pause();
        expect(engine.status).toBe('paused');
        expect(worker().types().at(-1)).toBe('PAUSE');
        expect(source().mode).toBe('idle');

        engine.resume();
        expect(engine.status).toBe('running');
        expect(worker().types()).toContain('RESUME');
        expect(source().mode).toBe('video-frame-callback');
    });

    test('pausar antes de estar listo no arranca la cámara al llegar READY', () => {
        const { engine, worker, workers, statuses } = setup();

        engine.start();
        engine.pause();
        worker().reply(READY);

        expect(engine.status).toBe('paused');
        expect(worker().types().slice(-2)).toEqual(['SESSION_START', 'PAUSE']);
        expect(workers[0].frames()).toHaveLength(0);

        engine.resume();

        expect(statuses.at(-1)).toBe('loading');
    });

    test('la sensibilidad y los blendshapes se envían al worker', () => {
        const { engine, worker } = setup();

        engine.start();
        worker().reply(READY);
        engine.setSensitivity(8);
        engine.setEnableBlendshapes(true);

        expect(
            worker()
                .posted.slice(-2)
                .map((entry) => entry.message),
        ).toEqual([
            { type: 'SET_CONFIG', config: { sensitivity: 8 } },
            { type: 'SET_CONFIG', config: { enableBlendshapes: true } },
        ]);
    });

    test('lo que se cambia mientras el motor carga llega con la sesión', () => {
        const { engine, worker } = setup();

        engine.start();
        engine.setSensitivity(8);

        expect(worker().types()).not.toContain('SET_CONFIG');

        worker().reply(READY);

        expect(worker().messages('SESSION_START')[0].config).toEqual({
            sensitivity: 8,
            enableBlendshapes: false,
        });
    });

    test('una calibración pedida mientras carga se hace al abrir la sesión', () => {
        const baselines: number[] = [];
        const { engine, worker } = setup({
            onCalibrated: (baseline) => baselines.push(baseline.capturedAt),
        });

        engine.start();
        engine.calibrateNeutral();

        expect(engine.calibrationState).toEqual({
            status: 'calibrating',
            automatic: false,
        });
        expect(worker().types()).not.toContain('CALIBRATE_NEUTRAL');

        worker().reply(READY);

        expect(worker().types().slice(-2)).toEqual([
            'SESSION_START',
            'CALIBRATE_NEUTRAL',
        ]);

        worker().reply({
            type: 'CALIBRATED',
            sessionId: worker().sessionId(),
            baseline: { capturedAt: 7, blendshapes: {} },
        });

        expect(baselines).toEqual([7]);
        expect(engine.calibrationState).toEqual({
            status: 'calibrated',
            automatic: false,
        });
    });

    test('los diagnósticos dicen con qué corre el motor', async () => {
        const { engine, startAndBecomeReady } = setup();

        expect(engine.getDiagnostics().frameSource).toBe('idle');

        await startAndBecomeReady();

        expect(engine.getDiagnostics()).toEqual({
            info: READY.info,
            runtime: 'cold',
            frameSource: 'video-frame-callback',
            frames: { sent: 1, completed: 0, skipped: 0 },
        });
    });

    test('los fps de la cámara salen del contador de la pista si existe', async () => {
        const emitted: { cameraFps: number | null }[] = [];
        let total = 0;
        const { scheduler, startAndBecomeReady } = setup(
            {
                onMetrics: (metrics) => {
                    if (metrics) emitted.push(metrics);
                },
            },
            {
                readCameraFrameCount: () => {
                    total += 30;

                    return total;
                },
            },
        );

        await startAndBecomeReady();

        // Cada medio segundo el contador sube 30: 60 fps.
        scheduler.advance(1500);

        expect(emitted.at(-1)?.cameraFps).toBe(60);
    });

    test('el delegado pedido llega al worker', () => {
        const { engine, worker } = setup({}, { delegate: 'CPU' });

        engine.start();

        expect(worker().posted[0].message).toMatchObject({
            type: 'INIT',
            delegate: 'CPU',
        });
    });

    test('con autoCalibrate calibra en cuanto el motor está listo', () => {
        const states: string[] = [];
        const { engine, worker } = setup(
            { onCalibrationChange: (state) => states.push(state.status) },
            { autoCalibrate: true },
        );

        engine.start();
        expect(worker().types()).not.toContain('CALIBRATE_NEUTRAL');

        worker().reply(READY);

        expect(worker().types()).toContain('CALIBRATE_NEUTRAL');
        expect(engine.calibrationState).toEqual({
            status: 'calibrating',
            automatic: true,
        });
        expect(states).toEqual(['calibrating']);
    });

    test('sin autoCalibrate solo calibra cuando se pide', () => {
        const { engine, worker } = setup();

        engine.start();
        worker().reply(READY);

        expect(worker().types()).not.toContain('CALIBRATE_NEUTRAL');
        expect(engine.calibrationState).toEqual({ status: 'idle' });

        engine.calibrateNeutral();

        expect(engine.calibrationState).toEqual({
            status: 'calibrating',
            automatic: false,
        });
    });

    test('informa de la calibración terminada o fallida', () => {
        const baselines: number[] = [];
        const { engine, worker } = setup(
            { onCalibrated: (baseline) => baselines.push(baseline.capturedAt) },
            { autoCalibrate: true },
        );

        engine.start();
        worker().reply(READY);
        worker().reply({
            type: 'CALIBRATION_FAILED',
            sessionId: worker().sessionId(),
            reason: 'not_frontal',
        });

        expect(engine.calibrationState).toEqual({
            status: 'failed',
            automatic: true,
            reason: 'not_frontal',
        });

        engine.calibrateNeutral();
        worker().reply({
            type: 'CALIBRATED',
            sessionId: worker().sessionId(),
            baseline: { capturedAt: 9, blendshapes: {} },
        });

        expect(engine.calibrationState).toEqual({
            status: 'calibrated',
            automatic: false,
        });
        expect(baselines).toEqual([9]);
    });

    test('calibrar sin motor arrancado no hace nada', () => {
        const { engine } = setup();

        engine.calibrateNeutral();

        expect(engine.calibrationState).toEqual({ status: 'idle' });
    });

    test('al parar, la calibración vuelve a idle', () => {
        const { engine, worker } = setup({}, { autoCalibrate: true });

        engine.start();
        worker().reply(READY);
        engine.stop();

        expect(engine.calibrationState).toEqual({ status: 'idle' });
    });

    test('cada fotograma analizado llega a onFrame', async () => {
        const frames: unknown[] = [];
        const { replyToLastFrame, startAndBecomeReady } = setup({
            onFrame: (frame) => frames.push(frame),
        });

        await startAndBecomeReady();
        replyToLastFrame({
            timestamp: 12,
            headPose: { yaw: 0, pitch: 0, roll: 0, timestamp: 12 },
            blendshapes: { jawOpen: 0.4 },
        });

        expect(frames).toEqual([
            {
                timestamp: 12,
                headPose: { yaw: 0, pitch: 0, roll: 0, timestamp: 12 },
                blendshapes: { jawOpen: 0.4 },
                gestures: [],
            },
        ]);
    });
});

describe('GestureEngineController — vista de la cámara', () => {
    test('se cede un lienzo al worker al abrir la sesión y se suelta al parar', () => {
        const { engine, worker } = setup();
        const surface = new FakePreviewSurface();

        engine.attachPreview(surface, PREVIEW);
        engine.start();

        // Sin sesión no hay a quién cederlo.
        expect(surface.created).toHaveLength(0);

        worker().reply(READY);

        const attach = worker().posted.find(
            (entry) => entry.message.type === 'ATTACH_PREVIEW',
        );

        expect(attach?.message).toEqual({
            type: 'ATTACH_PREVIEW',
            canvas: surface.created[0],
            size: SIZE,
            options: PREVIEW,
        });
        expect(attach?.transfer).toEqual([surface.created[0]]);
        expect(worker().types().indexOf('ATTACH_PREVIEW')).toBeGreaterThan(
            worker().types().indexOf('SESSION_START'),
        );

        engine.stop();

        expect(worker().types().slice(-2)).toEqual([
            'DETACH_PREVIEW',
            'SESSION_END',
        ]);
        expect(surface.removed).toBe(1);
        expect(surface.listening).toBe(false);
    });

    test('cada sesión pide un lienzo nuevo (uno cedido no se puede recuperar)', () => {
        const { engine, worker } = setup();
        const surface = new FakePreviewSurface();

        engine.attachPreview(surface, PREVIEW);
        engine.start();
        worker().reply(READY);
        engine.stop();
        engine.start();

        expect(surface.created).toHaveLength(2);
        expect(worker().messages('ATTACH_PREVIEW')).toHaveLength(2);
    });

    test('los cambios de tamaño y de opciones llegan al worker', () => {
        const { engine, worker } = setup();
        const surface = new FakePreviewSurface();
        const resized = { width: 320, height: 240, pixelRatio: 1 };
        const full: PreviewOptions = { ...PREVIEW, mesh: 'full' };

        engine.attachPreview(surface, PREVIEW);
        engine.start();
        worker().reply(READY);
        surface.resize(resized);
        engine.updatePreview(full);

        expect(
            worker()
                .posted.slice(-2)
                .map((entry) => entry.message),
        ).toEqual([
            { type: 'RESIZE_PREVIEW', size: resized },
            { type: 'SET_PREVIEW', options: full },
        ]);
    });

    test('quitar la vista a mitad de sesión la suelta', () => {
        const { engine, worker } = setup();
        const surface = new FakePreviewSurface();

        const detach = engine.attachPreview(surface, PREVIEW);
        engine.start();
        worker().reply(READY);
        detach();
        detach(); // Solo cuenta una vez.

        expect(worker().messages('DETACH_PREVIEW')).toHaveLength(1);
        expect(surface.removed).toBe(1);

        engine.stop();

        expect(worker().messages('DETACH_PREVIEW')).toHaveLength(1);
    });

    test('una vista nueva sustituye a la anterior', () => {
        const { engine, worker } = setup();
        const first = new FakePreviewSurface();
        const second = new FakePreviewSurface();

        const detachFirst = engine.attachPreview(first, PREVIEW);
        engine.start();
        worker().reply(READY);
        engine.attachPreview(second, PREVIEW);

        expect(first.removed).toBe(1);
        expect(second.created).toHaveLength(1);

        // Quitar la vieja ya no toca la nueva.
        detachFirst();

        expect(second.removed).toBe(0);
    });

    test('si no se puede crear el lienzo, no se cede nada', () => {
        const { engine, worker } = setup();

        engine.attachPreview(new FakePreviewSurface(null), PREVIEW);
        engine.start();
        worker().reply(READY);

        expect(worker().types()).not.toContain('ATTACH_PREVIEW');
    });

    test('lo que tarda en dibujarse llega a la telemetría', async () => {
        const { telemetry, replyToLastFrame, startAndBecomeReady } = setup();

        await startAndBecomeReady();
        replyToLastFrame({ previewMs: 1.5 });

        expect(telemetry.snapshot()[TELEMETRY_KEYS.previewMs]).toMatchObject({
            count: 1,
            max: 1.5,
        });
    });
});
