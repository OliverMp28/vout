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
} from '@/lib/mediapipe/gesture-engine';
import type { GestureWorkerLike } from '@/lib/mediapipe/gesture-worker-factory';
import { TelemetryCollector } from '@/lib/mediapipe/telemetry';
import { GestureType } from '@/lib/mediapipe/types';
import type {
    EngineStatus,
    MediaPipeRuntimeAssets,
    WorkerInMessage,
    WorkerOutMessage,
} from '@/lib/mediapipe/types';

import { ManualScheduler, flushPromises } from '../support/manual-scheduler';

const TIME_ORIGIN = 1_000_000;

const ASSETS: MediaPipeRuntimeAssets = {
    visionBundleUrl: 'http://vout.test/build/assets/vision_bundle.js',
    wasm: {
        simd: {
            wasmLoaderPath: 'http://vout.test/simd.js',
            wasmBinaryPath: 'http://vout.test/simd.wasm',
        },
        nosimd: {
            wasmLoaderPath: 'http://vout.test/nosimd.js',
            wasmBinaryPath: 'http://vout.test/nosimd.wasm',
        },
    },
    modelUrl: 'http://vout.test/models/face_landmarker.task',
};

const READY: WorkerOutMessage = {
    type: 'READY',
    info: {
        mediapipeVersion: '0.10.35',
        delegate: 'GPU',
        simd: true,
        renderer: 'Test GPU',
    },
};

class FakeWorker implements GestureWorkerLike {
    onmessage: GestureWorkerLike['onmessage'] = null;
    onerror: GestureWorkerLike['onerror'] = null;
    posted: { message: WorkerInMessage; transfer?: Transferable[] }[] = [];
    terminated = false;

    postMessage(message: WorkerInMessage, transfer?: Transferable[]): void {
        this.posted.push({ message, transfer });
    }

    terminate(): void {
        this.terminated = true;
    }

    /** El worker responde con `message`. */
    reply(message: WorkerOutMessage): void {
        this.onmessage?.({ data: message } as MessageEvent<WorkerOutMessage>);
    }

    types(): string[] {
        return this.posted.map((entry) => entry.message.type);
    }

    frames(): Extract<WorkerInMessage, { type: 'FRAME' }>[] {
        return this.posted
            .map((entry) => entry.message)
            .filter(
                (
                    message,
                ): message is Extract<WorkerInMessage, { type: 'FRAME' }> =>
                    message.type === 'FRAME',
            );
    }
}

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

function setup(
    events: GestureEngineEvents = {},
    overrides: Partial<GestureEngineOptions> = {},
) {
    const scheduler = new ManualScheduler();
    const telemetry = new TelemetryCollector();
    const workers: FakeWorker[] = [];
    const sources: FakeFrameSource[] = [];
    const statuses: EngineStatus[] = [];
    const errors: (string | null)[] = [];
    let disposed = 0;

    const engine = new GestureEngineController({
        createWorker: () => {
            const worker = new FakeWorker();
            workers.push(worker);

            return { worker, dispose: () => disposed++ };
        },
        resolveAssets: () => ASSETS,
        mediapipeVersion: '0.10.35',
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

    const worker = () => workers[workers.length - 1];
    const source = () => sources[sources.length - 1];

    /** Respuesta del worker al último FRAME, con tiempos coherentes. */
    const replyToLastFrame = (
        overrides: Partial<Extract<WorkerOutMessage, { type: 'RESULT' }>> = {},
    ) => {
        const frame = worker().frames().at(-1)!;
        const now = TIME_ORIGIN + scheduler.now();

        worker().reply({
            type: 'RESULT',
            frameId: frame.frameId,
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
        worker,
        source,
        workers,
        replyToLastFrame,
        startAndBecomeReady,
        get disposed() {
            return disposed;
        },
    };
}

describe('GestureEngineController', () => {
    beforeEach(() => {
        // Los fallos simulados se registran en consola; aquí sobran.
        spyOn(console, 'error').mockImplementation(() => {});
    });

    test('arranca el worker con las URLs locales, la versión y la configuración', () => {
        const { engine, worker, statuses } = setup();

        engine.start();

        expect(statuses).toEqual(['loading']);
        expect(worker().posted[0].message).toEqual({
            type: 'INIT',
            assets: ASSETS,
            mediapipeVersion: '0.10.35',
            config: { sensitivity: 5, enableBlendshapes: false },
        });
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
            frameId: frame.frameId,
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
        });

        // Segundo, con hora de captura de la cámara (20 ms antes).
        scheduler.advance(10);
        source().emit(scheduler.now() - 20);
        await flushPromises();

        const second = worker().frames()[1];

        scheduler.advance(40);
        worker().reply({
            type: 'RESULT',
            frameId: second.frameId,
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

    test('stop cierra el worker, la cámara y las métricas', async () => {
        const metrics: unknown[] = [];
        const setupResult = setup({
            onMetrics: (value) => metrics.push(value),
        });
        const { engine, worker, source, startAndBecomeReady } = setupResult;

        await startAndBecomeReady();
        engine.stop();

        expect(worker().types().at(-1)).toBe('DESTROY');
        expect(worker().terminated).toBe(true);
        expect(setupResult.disposed).toBe(1);
        expect(source().mode).toBe('idle');
        expect(engine.status).toBe('idle');
        expect(metrics.at(-1)).toBeNull();

        // Un mensaje tardío del worker ya cerrado no hace nada.
        worker().reply(READY);
        expect(engine.status).toBe('idle');
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
        expect(workers[0].frames()).toHaveLength(0);

        engine.resume();

        expect(statuses.at(-1)).toBe('loading');
    });

    test('la sensibilidad y los blendshapes se envían al worker', () => {
        const { engine, worker } = setup();

        engine.start();
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

    test('CALIBRATED llega al callback', () => {
        const baselines: number[] = [];
        const { engine, worker } = setup({
            onCalibrated: (baseline) => baselines.push(baseline.capturedAt),
        });

        engine.start();
        engine.calibrateNeutral();
        worker().reply({
            type: 'CALIBRATED',
            baseline: { capturedAt: 7, blendshapes: {} },
        });

        expect(worker().types()).toContain('CALIBRATE_NEUTRAL');
        expect(baselines).toEqual([7]);
    });

    test('los diagnósticos dicen con qué corre el motor', async () => {
        const { engine, startAndBecomeReady } = setup();

        expect(engine.getDiagnostics().frameSource).toBe('idle');

        await startAndBecomeReady();

        expect(engine.getDiagnostics()).toEqual({
            info: READY.type === 'READY' ? READY.info : null,
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
});
