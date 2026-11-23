import { describe, expect, test } from 'bun:test';

import { runWhenIdle } from '@/lib/mediapipe/idle-task';
import type { IdleEnvironment } from '@/lib/mediapipe/idle-task';
import {
    NO_DEVICE_LIMITS,
    decidePreload,
    facialControlIntent,
    readDeviceHints,
} from '@/lib/mediapipe/preload-policy';
import type {
    DeviceHints,
    FacialControlIntent,
    PreloadContext,
} from '@/lib/mediapipe/preload-policy';
import {
    PREFETCH_ATTRIBUTE,
    prefetchRuntimeAssets,
    runtimePrefetchUrls,
} from '@/lib/mediapipe/runtime-prefetch';
import type { PrefetchDocument } from '@/lib/mediapipe/runtime-prefetch';

import { TEST_ASSETS } from '../support/fake-worker';

// ---------------------------------------------------------------------------
// Política
// ---------------------------------------------------------------------------

function decide(
    context: PreloadContext,
    {
        intent = 'enabled',
        hasProfile = true,
        gameSupportsFacialControl = true,
        device = {},
    }: {
        intent?: FacialControlIntent;
        hasProfile?: boolean;
        gameSupportsFacialControl?: boolean;
        device?: Partial<DeviceHints>;
    } = {},
) {
    return decidePreload({
        intent,
        context,
        hasProfile,
        gameSupportsFacialControl,
        device: { ...NO_DEVICE_LIMITS, ...device },
    });
}

const ALL_CONTEXTS = ['play', 'game-detail', 'game-entry', 'setup'] as const;

describe('decidePreload', () => {
    test('sin control facial no se adelanta nada, en ninguna página', () => {
        for (const context of ALL_CONTEXTS) {
            expect(decide(context, { intent: 'none' })).toBe('none');
        }
    });

    test('un juego que no admite el control facial no adelanta nada', () => {
        for (const intent of ['enabled', 'primary'] as const) {
            for (const context of [
                'play',
                'game-detail',
                'game-entry',
            ] as const) {
                expect(
                    decide(context, {
                        intent,
                        gameSupportsFacialControl: false,
                    }),
                ).toBe('none');
            }
        }
    });

    test('en la página de juego se prepara el motor', () => {
        expect(decide('play')).toBe('warm');
    });

    test('en la página de juego sin perfil no (no se puede activar)', () => {
        expect(decide('play', { hasProfile: false })).toBe('none');
    });

    test('desde donde se entra a jugar solo se descargan los ficheros', () => {
        expect(decide('game-entry')).toBe('prefetch');
        expect(decide('game-entry', { hasProfile: false })).toBe('prefetch');
        expect(decide('game-detail')).toBe('prefetch');
    });

    test('quien juega con la cámara tiene el motor listo desde la ficha', () => {
        expect(decide('game-detail', { intent: 'primary' })).toBe('warm');
        // "Seguir jugando" sigue descargando solo.
        expect(decide('game-entry', { intent: 'primary' })).toBe('prefetch');
    });

    test('quien juega con la cámara prepara el motor aunque no tenga perfil', () => {
        expect(decide('play', { intent: 'primary', hasProfile: false })).toBe(
            'warm',
        );
    });

    test('con poca memoria la ficha descarga, pero no prepara el motor', () => {
        expect(
            decide('game-detail', {
                intent: 'primary',
                device: { lowMemory: true },
            }),
        ).toBe('prefetch');
    });

    test('configurando el control facial se prepara el motor', () => {
        expect(decide('setup', { hasProfile: false })).toBe('warm');
    });

    test('con ahorro de datos o conexión lenta, nada', () => {
        for (const context of ALL_CONTEXTS) {
            expect(decide(context, { device: { saveData: true } })).toBe(
                'none',
            );
            expect(decide(context, { device: { slowNetwork: true } })).toBe(
                'none',
            );
        }
    });

    test('con poca memoria no se prepara el motor, pero sí se descarga', () => {
        expect(decide('play', { device: { lowMemory: true } })).toBe('none');
        expect(decide('setup', { device: { lowMemory: true } })).toBe('none');
        expect(decide('game-entry', { device: { lowMemory: true } })).toBe(
            'prefetch',
        );
    });
});

describe('facialControlIntent', () => {
    test('sale del perfil de uso del usuario', () => {
        expect(facialControlIntent({ facial_control_usage: 'off' })).toBe(
            'none',
        );
        expect(
            facialControlIntent({ facial_control_usage: 'occasional' }),
        ).toBe('enabled');
        expect(facialControlIntent({ facial_control_usage: 'primary' })).toBe(
            'primary',
        );
    });

    test('un perfil desconocido cuenta como no usar la cámara', () => {
        expect(facialControlIntent({ facial_control_usage: 'always' })).toBe(
            'none',
        );
        expect(facialControlIntent({ facial_control_usage: null })).toBe(
            'none',
        );
    });

    test('sin ajustes o sin sesión, ninguna', () => {
        expect(facialControlIntent(null)).toBe('none');
        expect(facialControlIntent(undefined)).toBe('none');
    });
});

describe('readDeviceHints', () => {
    test('lee el ahorro de datos, la conexión y la memoria', () => {
        expect(
            readDeviceHints({
                connection: { saveData: true, effectiveType: '2g' },
                deviceMemory: 2,
            }),
        ).toEqual({ saveData: true, slowNetwork: true, lowMemory: true });
    });

    test('un equipo normal no tiene límites', () => {
        expect(
            readDeviceHints({
                connection: { saveData: false, effectiveType: '4g' },
                deviceMemory: 8,
            }),
        ).toEqual(NO_DEVICE_LIMITS);
    });

    test('sin esas APIs (Firefox, Safari) se asume que no hay límites', () => {
        expect(readDeviceHints({})).toEqual(NO_DEVICE_LIMITS);
        expect(readDeviceHints(undefined)).toEqual(NO_DEVICE_LIMITS);
    });
});

// ---------------------------------------------------------------------------
// Cuándo
// ---------------------------------------------------------------------------

class FakeIdleEnvironment implements IdleEnvironment {
    idleCallbacks: { callback: () => void; timeout: number }[] = [];
    timeouts: (() => void)[] = [];
    cancelled = 0;
    private visibilityListeners = new Set<() => void>();

    readonly document = {
        visibilityState: 'visible' as DocumentVisibilityState,
        addEventListener: (_type: 'visibilitychange', listener: () => void) =>
            this.visibilityListeners.add(listener),
        removeEventListener: (
            _type: 'visibilitychange',
            listener: () => void,
        ) => this.visibilityListeners.delete(listener),
    };

    requestIdleCallback?: IdleEnvironment['requestIdleCallback'] = (
        callback,
        options,
    ) => {
        this.idleCallbacks.push({ callback, timeout: options.timeout });

        return this.idleCallbacks.length;
    };

    cancelIdleCallback = () => {
        this.cancelled++;
    };

    setTimeout = (callback: () => void) => {
        this.timeouts.push(callback);

        return this.timeouts.length;
    };

    clearTimeout = () => {
        this.cancelled++;
    };

    /** El navegador queda libre: corre lo programado. */
    idle(): void {
        for (const { callback } of this.idleCallbacks.splice(0)) {
            callback();
        }

        for (const callback of this.timeouts.splice(0)) {
            callback();
        }
    }

    show(): void {
        this.document.visibilityState = 'visible';

        for (const listener of [...this.visibilityListeners]) {
            listener();
        }
    }

    get listeners(): number {
        return this.visibilityListeners.size;
    }
}

describe('runWhenIdle', () => {
    test('espera a que el navegador esté libre', () => {
        const environment = new FakeIdleEnvironment();
        let runs = 0;

        runWhenIdle(() => runs++, 2000, environment);

        expect(runs).toBe(0);
        expect(environment.idleCallbacks[0].timeout).toBe(2000);

        environment.idle();

        expect(runs).toBe(1);
    });

    test('con la pestaña oculta espera a que se vea', () => {
        const environment = new FakeIdleEnvironment();
        let runs = 0;

        environment.document.visibilityState = 'hidden';
        runWhenIdle(() => runs++, 2000, environment);
        environment.idle();

        expect(runs).toBe(0);

        environment.show();
        environment.idle();

        expect(runs).toBe(1);
        expect(environment.listeners).toBe(0);
    });

    test('cancelarla antes evita que se ejecute', () => {
        const environment = new FakeIdleEnvironment();
        let runs = 0;

        const cancel = runWhenIdle(() => runs++, 2000, environment);

        cancel();
        environment.idle();

        expect(runs).toBe(0);
        expect(environment.cancelled).toBe(1);
    });

    test('cancelarla con la pestaña oculta deja de escuchar', () => {
        const environment = new FakeIdleEnvironment();

        environment.document.visibilityState = 'hidden';
        const cancel = runWhenIdle(() => {}, 2000, environment);

        cancel();

        expect(environment.listeners).toBe(0);
    });

    test('sin requestIdleCallback (Safari) usa un temporizador', () => {
        const environment = new FakeIdleEnvironment();
        let runs = 0;

        environment.requestIdleCallback = undefined;
        runWhenIdle(() => runs++, 2000, environment);
        environment.idle();

        expect(runs).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Descarga a la caché
// ---------------------------------------------------------------------------

type FakeLink = {
    rel: string;
    href: string;
    crossOrigin: string | null;
    attributes: Record<string, string>;
    setAttribute(name: string, value: string): void;
};

function fakeDocument() {
    const links: FakeLink[] = [];

    const doc = {
        head: {
            appendChild: (node: HTMLLinkElement) =>
                links.push(node as unknown as FakeLink),
        },
        createElement: () => {
            const link: FakeLink = {
                rel: '',
                href: '',
                crossOrigin: null,
                attributes: {},
                setAttribute: (name, value) => {
                    link.attributes[name] = value;
                },
            };

            return link as unknown as HTMLLinkElement;
        },
        querySelectorAll: (selector: string) =>
            selector === `link[${PREFETCH_ATTRIBUTE}]`
                ? links.filter((link) => PREFETCH_ATTRIBUTE in link.attributes)
                : [],
    } satisfies PrefetchDocument;

    return { doc, links };
}

describe('prefetchRuntimeAssets', () => {
    const urls = runtimePrefetchUrls(TEST_ASSETS);

    test('descarga el bundle, el WASM con SIMD y el modelo', () => {
        expect(urls).toEqual([
            TEST_ASSETS.visionBundleUrl,
            TEST_ASSETS.wasm.simd.wasmLoaderPath,
            TEST_ASSETS.wasm.simd.wasmBinaryPath,
            TEST_ASSETS.modelUrl,
        ]);
    });

    test('añade un prefetch por fichero, pedido como lo pedirá el worker', () => {
        const { doc, links } = fakeDocument();

        expect(prefetchRuntimeAssets(urls, doc)).toBe(4);
        expect(links.map((link) => link.href)).toEqual(urls);
        expect(
            links.every(
                (link) =>
                    link.rel === 'prefetch' && link.crossOrigin === 'anonymous',
            ),
        ).toBe(true);
    });

    test('no repite los que ya están', () => {
        const { doc, links } = fakeDocument();

        prefetchRuntimeAssets(urls, doc);

        expect(prefetchRuntimeAssets(urls, doc)).toBe(0);
        expect(links).toHaveLength(4);
    });
});
