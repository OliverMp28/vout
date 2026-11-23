import { beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { INIT_TIMEOUT_MESSAGE } from '@/lib/mediapipe/engine-runtime';
import type { SessionOutMessage } from '@/lib/mediapipe/types';

import { READY, TEST_ASSETS, createTestHost } from '../support/fake-worker';
import { ManualScheduler } from '../support/manual-scheduler';

const KEEP_WARM_MS = 300_000;

function setup() {
    const scheduler = new ManualScheduler();
    const fixture = createTestHost(scheduler);

    return {
        scheduler,
        host: fixture.host,
        workers: fixture.workers,
        worker: fixture.worker,
        get disposed() {
            return fixture.disposed;
        },
    };
}

describe('RuntimeHost', () => {
    beforeEach(() => {
        // Los fallos simulados se registran en consola; aquí sobran.
        spyOn(console, 'error').mockImplementation(() => {});
    });

    test('en frío crea el worker y lo carga sin configuración de sesión', () => {
        const { host, worker } = setup();

        const lease = host.acquire('GPU');

        expect(lease.reuse).toBe('cold');
        expect(lease.runtime.state).toBe('loading');
        expect(worker().posted).toEqual([
            {
                message: {
                    type: 'INIT',
                    assets: TEST_ASSETS,
                    mediapipeVersion: '0.10.35',
                    delegate: 'GPU',
                },
                transfer: undefined,
            },
        ]);
    });

    test('READY llega a quien lo tiene prestado', () => {
        const { host, worker } = setup();
        const ready: unknown[] = [];
        const lease = host.acquire('GPU');

        lease.runtime.setListener({ onReady: (info) => ready.push(info) });
        worker().reply(READY);

        expect(lease.runtime.state).toBe('ready');
        expect(lease.runtime.info).toEqual(READY.info);
        expect(ready).toEqual([READY.info]);
    });

    test('al devolverlo queda en caliente y la siguiente sesión lo reutiliza', () => {
        const { host, workers } = setup();

        const first = host.acquire('GPU');
        workers[0].reply(READY);
        first.release();

        expect(workers[0].terminated).toBe(false);
        expect(host.warmState).toBe('ready');

        const second = host.acquire('GPU');

        expect(second.reuse).toBe('warm');
        expect(second.runtime).toBe(first.runtime);
        expect(workers).toHaveLength(1);
        expect(workers[0].types()).toEqual(['INIT']);
    });

    test('una precarga en curso se presta como warming', () => {
        const { host, workers } = setup();

        host.prewarm('GPU');
        const lease = host.acquire('GPU');

        expect(lease.reuse).toBe('warming');
        expect(workers).toHaveLength(1);
    });

    test('prewarm no duplica el motor', () => {
        const { host, workers } = setup();

        host.prewarm();
        host.prewarm('GPU');

        expect(workers).toHaveLength(1);
    });

    test('caduca a los 5 minutos sin uso', () => {
        const fixture = setup();
        const { host, scheduler, worker } = fixture;

        const lease = host.acquire('GPU');
        worker().reply(READY);
        lease.release();
        scheduler.advance(KEEP_WARM_MS - 1);

        expect(worker().terminated).toBe(false);

        scheduler.advance(1);

        expect(worker().terminated).toBe(true);
        expect(worker().types().at(-1)).toBe('DESTROY');
        expect(fixture.disposed).toBe(1);
        expect(host.warmState).toBe('none');
    });

    test('una precarga sin nadie que la retenga también caduca', () => {
        const { host, scheduler, worker } = setup();

        host.prewarm();
        scheduler.advance(KEEP_WARM_MS);

        expect(worker().terminated).toBe(true);
    });

    test('mientras alguien lo retiene no caduca; al soltarlo vuelve a contar', () => {
        const { host, scheduler, worker } = setup();

        const release = host.retain();
        host.prewarm();
        worker().reply(READY);
        scheduler.advance(KEEP_WARM_MS * 3);

        expect(worker().terminated).toBe(false);

        release();
        release(); // Solo cuenta una vez.
        scheduler.advance(KEEP_WARM_MS);

        expect(worker().terminated).toBe(true);
    });

    test('prestado no caduca', () => {
        const { host, scheduler, worker } = setup();

        host.acquire('GPU');
        worker().reply(READY);
        scheduler.advance(KEEP_WARM_MS * 2);

        expect(worker().terminated).toBe(false);
    });

    test('con otro delegado se descarta el caliente y se crea uno nuevo', () => {
        const { host, workers } = setup();

        host.prewarm('GPU');
        const lease = host.acquire('CPU');

        expect(workers[0].terminated).toBe(true);
        expect(lease.reuse).toBe('cold');
        expect(workers[1].messages('INIT')[0].delegate).toBe('CPU');
    });

    test('devolverlo con discard lo cierra', () => {
        const { host, worker } = setup();

        host.acquire('GPU').release({ discard: true });

        expect(worker().terminated).toBe(true);
        expect(host.warmState).toBe('none');
    });

    test('un ERROR en reposo lo descarta y la siguiente sesión empieza en frío', () => {
        const { host, workers } = setup();

        host.prewarm();
        workers[0].reply({ type: 'ERROR', code: 'INIT_FAILED', message: 'x' });

        expect(workers[0].terminated).toBe(true);
        expect(host.warmState).toBe('none');
        expect(host.acquire('GPU').reuse).toBe('cold');
        expect(workers).toHaveLength(2);
    });

    test('un ERROR con el motor prestado avisa y no se reutiliza', () => {
        const { host, workers } = setup();
        const deaths: string[] = [];
        const lease = host.acquire('GPU');

        lease.runtime.setListener({ onDead: (reason) => deaths.push(reason) });
        workers[0].reply(READY);
        workers[0].reply({
            type: 'ERROR',
            code: 'INFERENCE_FAILED',
            message: 'GPU lost',
        });

        expect(deaths).toEqual(['GPU lost']);
        expect(workers[0].terminated).toBe(true);

        lease.release();

        expect(host.acquire('GPU').reuse).toBe('cold');
    });

    test('un error no capturado del worker también lo mata', () => {
        const { host, worker } = setup();
        const deaths: string[] = [];
        const lease = host.acquire('GPU');

        lease.runtime.setListener({ onDead: (reason) => deaths.push(reason) });
        worker().onerror?.({ message: 'kaput' } as ErrorEvent);

        expect(deaths).toEqual(['kaput']);
        expect(lease.runtime.state).toBe('dead');
    });

    test('si no avisa de que está listo a tiempo, se da por muerto', () => {
        const { host, scheduler, worker } = setup();
        const deaths: string[] = [];
        const lease = host.acquire('GPU');

        lease.runtime.setListener({ onDead: (reason) => deaths.push(reason) });
        scheduler.advance(30_000);

        expect(deaths).toEqual([INIT_TIMEOUT_MESSAGE]);
        expect(worker().terminated).toBe(true);
    });

    test('READY a tiempo cancela el plazo de arranque', () => {
        const { host, scheduler, worker } = setup();
        const lease = host.acquire('GPU');

        worker().reply(READY);
        scheduler.advance(60_000);

        expect(lease.runtime.state).toBe('ready');
    });

    test('los mensajes de sesión solo llegan a quien lo tiene prestado', () => {
        const { host, worker } = setup();
        const received: SessionOutMessage[] = [];
        const dropped: SessionOutMessage = {
            type: 'FRAME_DROPPED',
            sessionId: 1,
            frameId: 1,
            reason: 'error',
        };
        const lease = host.acquire('GPU');

        lease.runtime.setListener({
            onMessage: (message) => received.push(message),
        });
        worker().reply(dropped);
        lease.release();
        worker().reply(dropped);

        expect(received).toEqual([dropped]);
    });

    test('si el del pool ya está prestado, presta otro aparte que no se reutiliza', () => {
        const { host, workers } = setup();

        host.acquire('GPU');
        const second = host.acquire('GPU');

        expect(second.reuse).toBe('cold');
        expect(workers).toHaveLength(2);

        second.release();

        expect(workers[1].terminated).toBe(true);
        expect(workers[0].terminated).toBe(false);
    });

    test('release solo cuenta la primera vez', () => {
        const { host, workers } = setup();

        const lease = host.acquire('GPU');
        lease.release();
        const next = host.acquire('GPU');

        lease.release({ discard: true });

        expect(next.runtime.state).toBe('loading');
        expect(workers[0].terminated).toBe(false);
    });

    test('disposeIdle libera el caliente pero no uno prestado', () => {
        const { host, workers } = setup();

        host.prewarm();
        host.disposeIdle();

        expect(workers[0].terminated).toBe(true);

        host.acquire('GPU');
        host.disposeIdle();

        expect(workers[1].terminated).toBe(false);
    });

    test('disposeAll cierra todos', () => {
        const { host, workers } = setup();

        host.acquire('GPU');
        host.acquire('GPU');
        host.disposeAll();

        expect(workers.every((worker) => worker.terminated)).toBe(true);
    });

    test('un mensaje de un worker ya cerrado no hace nada', () => {
        const { host, worker } = setup();
        const ready: unknown[] = [];
        const lease = host.acquire('GPU');

        lease.runtime.setListener({ onReady: (info) => ready.push(info) });
        lease.release({ discard: true });
        worker().reply(READY);

        expect(ready).toEqual([]);
        expect(lease.runtime.state).toBe('dead');
    });

    test('avisa de cada cambio del motor en caliente', () => {
        const { host, worker } = setup();
        const states: string[] = [];
        const unsubscribe = host.subscribe(() => states.push(host.warmState));

        host.prewarm();
        host.prewarm(); // Sin cambios: sin aviso.
        worker().reply(READY);
        host.disposeIdle();
        unsubscribe();
        host.prewarm();

        expect(states).toEqual(['loading', 'ready', 'none']);
    });

    test('también avisa si muere', () => {
        const { host, worker } = setup();
        const states: string[] = [];

        host.subscribe(() => states.push(host.warmState));
        const lease = host.acquire('GPU');
        worker().reply({ type: 'ERROR', code: 'UNCAUGHT', message: 'x' });
        lease.release();

        expect(states).toEqual(['loading', 'dead', 'none']);
    });
});
