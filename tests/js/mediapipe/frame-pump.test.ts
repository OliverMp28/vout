import { describe, expect, test } from 'bun:test';

import { FramePump } from '@/lib/mediapipe/frame-pump';

import { ManualScheduler, flushPromises } from '../support/manual-scheduler';

type FakeFrame = { image: number };

const TIMEOUT_MS = 15_000;

/** Bomba con una cámara falsa: `cameraImage` es la imagen "actual". */
function setup(options: { capture?: () => Promise<FakeFrame | null> } = {}) {
    const scheduler = new ManualScheduler();
    const camera = { image: 0 };
    const sent: { frameId: number; frame: FakeFrame; timestamp: number }[] = [];
    const discarded: FakeFrame[] = [];
    const timeouts: number[] = [];

    const pump = new FramePump<FakeFrame>({
        capture:
            options.capture ?? (() => Promise.resolve({ image: camera.image })),
        send: (frameId, frame, timestamp) =>
            sent.push({ frameId, frame, timestamp }),
        discard: (frame) => discarded.push(frame),
        scheduler,
        responseTimeoutMs: TIMEOUT_MS,
        onResponseTimeout: (frame) => timeouts.push(frame.frameId),
    });

    /** La cámara entrega la imagen `image`. */
    const cameraFrame = async (image: number, captureTime = null) => {
        camera.image = image;
        pump.notifyFrame({ key: image, captureTime });
        await flushPromises();
    };

    return { scheduler, pump, sent, discarded, timeouts, cameraFrame };
}

describe('FramePump', () => {
    test('no envía nada hasta que arranca y hay una imagen', async () => {
        const { pump, sent, cameraFrame } = setup();

        await cameraFrame(1);
        expect(sent).toHaveLength(0);

        pump.start();
        await flushPromises();

        expect(sent.map((s) => s.frame.image)).toEqual([1]);
    });

    test('nunca hay más de un fotograma en vuelo', async () => {
        const { pump, sent, cameraFrame } = setup();

        pump.start();
        await cameraFrame(1);
        await cameraFrame(2);
        await cameraFrame(3);

        expect(sent).toHaveLength(1);
        expect(pump.hasFrameInFlight).toBe(true);
    });

    test('al responder el worker envía la imagen más reciente, no las intermedias', async () => {
        const { pump, sent, cameraFrame } = setup();

        pump.start();
        await cameraFrame(1);
        await cameraFrame(2);
        await cameraFrame(3);

        pump.complete(sent[0].frameId);
        await flushPromises();

        expect(sent.map((s) => s.frame.image)).toEqual([1, 3]);
        expect(pump.stats.skipped).toBe(1);
    });

    test('no repite una imagen ya enviada', async () => {
        const { pump, sent, cameraFrame } = setup();

        pump.start();
        await cameraFrame(1);
        pump.complete(sent[0].frameId);
        await flushPromises();

        expect(sent).toHaveLength(1);
        expect(pump.hasFrameInFlight).toBe(false);

        await cameraFrame(2);

        expect(sent.map((s) => s.frame.image)).toEqual([1, 2]);
    });

    test('complete devuelve el fotograma en vuelo con sus tiempos', async () => {
        const { scheduler, pump, sent, cameraFrame } = setup();

        scheduler.advance(100);
        pump.start();
        await cameraFrame(1);

        const done = pump.complete(sent[0].frameId);

        expect(done).toEqual({
            frameId: sent[0].frameId,
            stamp: { key: 1, captureTime: null },
            captureStartedAt: 100,
            sentAt: 100,
        });
        expect(pump.complete(sent[0].frameId)).toBeNull();
        expect(pump.stats).toMatchObject({ sent: 1, completed: 1 });
    });

    test('si el worker tarda en responder, avisa pero no le manda otro', async () => {
        const { scheduler, pump, sent, timeouts, cameraFrame } = setup();

        pump.start();
        await cameraFrame(1);
        await cameraFrame(2);

        scheduler.advance(TIMEOUT_MS - 1);
        expect(timeouts).toEqual([]);

        scheduler.advance(1);
        await flushPromises();

        expect(timeouts).toEqual([sent[0].frameId]);
        expect(sent).toHaveLength(1);

        // La respuesta llega por fin: se completa y sale la imagen más reciente.
        expect(pump.complete(sent[0].frameId)).not.toBeNull();
        await flushPromises();

        expect(sent.map((s) => s.frame.image)).toEqual([1, 2]);
    });

    test('responder a tiempo cancela el vigilante', async () => {
        const { scheduler, pump, sent, timeouts, cameraFrame } = setup();

        pump.start();
        await cameraFrame(1);
        pump.complete(sent[0].frameId);
        scheduler.advance(TIMEOUT_MS * 3);

        expect(timeouts).toEqual([]);
        expect(scheduler.pendingTimers).toBe(0);
    });

    test('en pausa no envía; al reanudar envía la imagen más reciente', async () => {
        const { pump, sent, cameraFrame } = setup();

        pump.start();
        await cameraFrame(1);
        pump.pause();

        // La respuesta al fotograma en vuelo sigue valiendo.
        expect(pump.complete(sent[0].frameId)).not.toBeNull();

        await cameraFrame(2);
        await cameraFrame(3);
        expect(sent).toHaveLength(1);

        pump.start();
        await flushPromises();

        expect(sent.map((s) => s.frame.image)).toEqual([1, 3]);
    });

    test('una captura que termina después de parar se libera sin enviarse', async () => {
        let resolveCapture: (frame: FakeFrame) => void = () => {};
        const { pump, sent, discarded } = setup({
            capture: () =>
                new Promise<FakeFrame>((resolve) => {
                    resolveCapture = resolve;
                }),
        });

        pump.start();
        pump.notifyFrame({ key: 1, captureTime: null });
        pump.stop();

        resolveCapture({ image: 1 });
        await flushPromises();

        expect(sent).toEqual([]);
        expect(discarded).toEqual([{ image: 1 }]);
    });

    test('si aún no hay imagen que capturar, lo reintenta con la siguiente', async () => {
        let ready = false;
        const { pump, sent, cameraFrame } = setup({
            capture: () => Promise.resolve(ready ? { image: 2 } : null),
        });

        pump.start();
        await cameraFrame(1);
        expect(sent).toHaveLength(0);

        ready = true;
        await cameraFrame(2);

        expect(sent.map((s) => s.frame.image)).toEqual([2]);
    });

    test('un fallo de captura no bloquea la bomba', async () => {
        let fail = true;
        const { pump, sent, cameraFrame } = setup({
            capture: () =>
                fail
                    ? Promise.reject(new Error('resize'))
                    : Promise.resolve({ image: 2 }),
        });

        pump.start();
        await cameraFrame(1);
        expect(sent).toHaveLength(0);

        fail = false;
        await cameraFrame(2);

        expect(sent).toHaveLength(1);
    });

    test('las marcas de tiempo enviadas son estrictamente crecientes', async () => {
        const { pump, sent, cameraFrame } = setup();

        pump.start();

        for (let image = 1; image <= 4; image++) {
            await cameraFrame(image);
            pump.complete(sent[sent.length - 1].frameId);
        }

        const timestamps = sent.map((s) => s.timestamp);

        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
        }
    });

    test('stop olvida el fotograma en vuelo y el vigilante', async () => {
        const { scheduler, pump, timeouts, cameraFrame } = setup();

        pump.start();
        await cameraFrame(1);
        pump.stop();
        scheduler.advance(TIMEOUT_MS * 2);

        expect(pump.hasFrameInFlight).toBe(false);
        expect(timeouts).toEqual([]);
    });
});
