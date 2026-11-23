import { RuntimeHost } from '@/lib/mediapipe/engine-runtime';
import type { RuntimeHostOptions } from '@/lib/mediapipe/engine-runtime';
import type { GestureWorkerLike } from '@/lib/mediapipe/gesture-worker-factory';
import type {
    MediaPipeRuntimeAssets,
    WorkerInMessage,
    WorkerOutMessage,
} from '@/lib/mediapipe/types';

import type { ManualScheduler } from './manual-scheduler';

export const TEST_ASSETS: MediaPipeRuntimeAssets = {
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
    modelUrl: 'http://vout.test/build/assets/face_landmarker.task',
};

export const READY: Extract<WorkerOutMessage, { type: 'READY' }> = {
    type: 'READY',
    info: {
        mediapipeVersion: '0.10.35',
        delegate: 'GPU',
        simd: true,
        renderer: 'Test GPU',
        startup: { bundleMs: 10, landmarkerMs: 400, warmupMs: 120 },
    },
};

/** Un Worker que guarda lo que recibe y responde cuando el test lo pide. */
export class FakeWorker implements GestureWorkerLike {
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

    /** Los mensajes de un tipo, en orden. */
    messages<T extends WorkerInMessage['type']>(
        type: T,
    ): Extract<WorkerInMessage, { type: T }>[] {
        return this.posted
            .map((entry) => entry.message)
            .filter(
                (message): message is Extract<WorkerInMessage, { type: T }> =>
                    message.type === type,
            );
    }

    frames(): Extract<WorkerInMessage, { type: 'FRAME' }>[] {
        return this.messages('FRAME');
    }

    /** Id de la sesión abierta más reciente. */
    sessionId(): number {
        const started = this.messages('SESSION_START').at(-1);

        if (started === undefined) {
            throw new Error('No session was started');
        }

        return started.sessionId;
    }
}

/** Host de motores con workers falsos, para probar sin navegador. */
export function createTestHost(
    scheduler: ManualScheduler,
    overrides: Partial<RuntimeHostOptions> = {},
) {
    const workers: FakeWorker[] = [];
    let disposed = 0;

    const host = new RuntimeHost({
        createWorker: () => {
            const worker = new FakeWorker();
            workers.push(worker);

            return { worker, dispose: () => disposed++ };
        },
        resolveAssets: () => TEST_ASSETS,
        mediapipeVersion: '0.10.35',
        initTimeoutMs: 30_000,
        keepWarmMs: 300_000,
        scheduler,
        ...overrides,
    });

    return {
        host,
        workers,
        /** El último worker creado. */
        worker: () => {
            const last = workers.at(-1);

            if (last === undefined) {
                throw new Error('No worker was created');
            }

            return last;
        },
        get disposed() {
            return disposed;
        },
    };
}
