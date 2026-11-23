/**
 * El motor cargado: un worker con MediaPipe listo (bundle, WASM, modelo y
 * contexto de la GPU), separado de las sesiones que lo usan.
 *
 * Cargarlo cuesta (descargar, compilar el WASM, preparar el modelo y los
 * shaders); usarlo, no. Por eso:
 *
 *   - Cada activación del control facial es una **sesión**
 *     (`GestureEngineController`): abre la cámara, empieza con el estado
 *     limpio y, al parar, apaga la cámara y lo borra todo. Ver
 *     `detection-session.ts`.
 *   - El **motor** sobrevive a la sesión. `RuntimeHost` guarda uno en
 *     caliente: reactivar en la misma página, o ir del catálogo a otro juego,
 *     no lo recarga. Se libera tras `keepWarmMs` sin que nadie lo use ni lo
 *     retenga, y se descarta en cuanto falla (un motor con error no se
 *     reutiliza).
 *   - `prewarm()` lo prepara antes de que el usuario pulse, sin cámara. Quién
 *     y cuándo lo pide lo decide `preload-policy.ts`.
 *
 * Sin DOM ni React: el worker y el reloj se inyectan (la instancia de la
 * aplicación está en `shared-runtime.ts`).
 */

import type { GestureWorkerHandle } from './gesture-worker-factory';
import { realScheduler } from './scheduler';
import type { Scheduler, TimerHandle } from './scheduler';
import type {
    EngineInfo,
    MediaPipeRuntimeAssets,
    PreferredDelegate,
    SessionOutMessage,
    WorkerInMessage,
    WorkerOutMessage,
} from './types';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type RuntimeState = 'loading' | 'ready' | 'dead';

/**
 * En qué estado estaba el motor al prestarlo:
 * - `cold`    → hubo que crearlo.
 * - `warming` → se estaba preparando (una precarga en curso).
 * - `warm`    → ya estaba listo.
 */
export type RuntimeReuse = 'cold' | 'warming' | 'warm';

/** Lo que recibe quien tiene el motor prestado. */
export type RuntimeListener = {
    onReady?: (info: EngineInfo) => void;
    onMessage?: (message: SessionOutMessage) => void;
    /** El motor falló y ya está cerrado. */
    onDead?: (reason: string) => void;
};

export type RuntimeLease = {
    readonly runtime: EngineRuntime;
    readonly reuse: RuntimeReuse;
    /**
     * Devuelve el motor. Con `discard`, o si murió, se cierra; si no, queda
     * en caliente para la siguiente sesión. Solo cuenta la primera llamada.
     */
    release(options?: { discard?: boolean }): void;
};

export type RuntimeHostOptions = {
    createWorker: () => GestureWorkerHandle;
    /** Se resuelven al crear cada motor (necesitan `document.baseURI`). */
    resolveAssets: () => MediaPipeRuntimeAssets;
    mediapipeVersion: string;
    /** Si el worker no avisa de que está listo en este tiempo, se descarta. */
    initTimeoutMs: number;
    /** Tiempo en caliente sin usarse ni retenerse antes de liberarlo. */
    keepWarmMs: number;
    scheduler?: Scheduler;
};

/** Mensaje de error si el worker no llega a estar listo. */
export const INIT_TIMEOUT_MESSAGE =
    'Gesture engine timed out during initialization. Check browser console for details.';

// ---------------------------------------------------------------------------
// Un motor
// ---------------------------------------------------------------------------

export class EngineRuntime {
    readonly delegate: PreferredDelegate;

    private currentState: RuntimeState = 'loading';
    private currentInfo: EngineInfo | null = null;
    private listener: RuntimeListener | null = null;
    private handle: GestureWorkerHandle | null;
    private initTimer: TimerHandle | null = null;

    constructor(
        handle: GestureWorkerHandle,
        delegate: PreferredDelegate,
        init: { assets: MediaPipeRuntimeAssets; mediapipeVersion: string },
        private readonly scheduler: Scheduler,
        initTimeoutMs: number,
        private readonly onDeath: (runtime: EngineRuntime) => void,
        private readonly onReady: () => void = () => {},
    ) {
        this.delegate = delegate;
        this.handle = handle;

        handle.worker.onmessage = (event) => this.handleMessage(event.data);
        handle.worker.onerror = (event) => {
            console.error(
                '[GestureEngine] Worker uncaught error:',
                event.message,
            );
            this.die(event.message || 'Worker encountered an unexpected error');
        };

        handle.worker.postMessage({
            type: 'INIT',
            assets: init.assets,
            mediapipeVersion: init.mediapipeVersion,
            delegate,
        });

        this.initTimer = scheduler.setTimeout(() => {
            this.initTimer = null;
            console.error(
                '[GestureEngine] Init timeout — READY not received within',
                initTimeoutMs,
                'ms',
            );
            this.die(INIT_TIMEOUT_MESSAGE);
        }, initTimeoutMs);
    }

    get state(): RuntimeState {
        return this.currentState;
    }

    /** Con qué corre (lo informa el worker en `READY`). */
    get info(): EngineInfo | null {
        return this.currentInfo;
    }

    /** Quien tiene el motor prestado. Solo hay uno. */
    setListener(listener: RuntimeListener | null): void {
        this.listener = listener;
    }

    post(message: WorkerInMessage, transfer?: Transferable[]): void {
        if (this.handle === null) {
            return;
        }

        if (transfer === undefined) {
            this.handle.worker.postMessage(message);
        } else {
            this.handle.worker.postMessage(message, transfer);
        }
    }

    /** Cierra el worker sin avisar a nadie (lo pide el host). */
    dispose(): void {
        this.close();
        this.currentState = 'dead';
        this.listener = null;
    }

    private handleMessage(message: WorkerOutMessage): void {
        if (this.currentState === 'dead') {
            return;
        }

        switch (message.type) {
            case 'READY':
                if (this.currentState === 'loading') {
                    this.clearInitTimer();
                    this.currentState = 'ready';
                    this.currentInfo = message.info;
                    this.onReady();
                    this.listener?.onReady?.(message.info);
                }
                break;

            case 'ERROR':
                // Un worker que avisa de un error (al cargar, sin capturar o
                // tras muchos fallos seguidos) no se vuelve a usar.
                this.die(message.message);
                break;

            default:
                this.listener?.onMessage?.(message);
        }
    }

    private die(reason: string): void {
        if (this.currentState === 'dead') {
            return;
        }

        const listener = this.listener;

        this.dispose();
        this.onDeath(this);
        listener?.onDead?.(reason);
    }

    private close(): void {
        this.clearInitTimer();

        const handle = this.handle;

        this.handle = null;

        if (handle !== null) {
            handle.worker.onmessage = null;
            handle.worker.onerror = null;
            handle.worker.postMessage({ type: 'DESTROY' });
            handle.worker.terminate();
            handle.dispose();
        }
    }

    private clearInitTimer(): void {
        if (this.initTimer !== null) {
            this.scheduler.clearTimeout(this.initTimer);
            this.initTimer = null;
        }
    }
}

// ---------------------------------------------------------------------------
// El host: un motor en caliente como mucho
// ---------------------------------------------------------------------------

export class RuntimeHost {
    private readonly options: RuntimeHostOptions;
    private readonly scheduler: Scheduler;

    /** El motor que se reutiliza entre sesiones. */
    private pooled: EngineRuntime | null = null;
    private pooledLeased = false;
    /** Motores prestados aparte porque el del pool ya lo estaba. */
    private readonly extra = new Set<EngineRuntime>();

    private retainers = 0;
    private expiryTimer: TimerHandle | null = null;
    private readonly stateListeners = new Set<() => void>();
    private lastWarmState: RuntimeState | 'none' = 'none';

    constructor(options: RuntimeHostOptions) {
        this.options = options;
        this.scheduler = options.scheduler ?? realScheduler;
    }

    /**
     * Estado del motor en caliente, o `none` si no hay ninguno (para la
     * telemetría y los tests).
     */
    get warmState(): RuntimeState | 'none' {
        return this.pooled?.state ?? 'none';
    }

    /**
     * Avisa cada vez que cambia `warmState` (para mostrarlo, p. ej. con
     * `useSyncExternalStore`). Devuelve cómo dejar de oír.
     */
    subscribe(listener: () => void): () => void {
        this.stateListeners.add(listener);

        return () => {
            this.stateListeners.delete(listener);
        };
    }

    /**
     * Prepara un motor sin cámara para que la próxima activación sea
     * inmediata. No hace nada si ya hay uno (listo o preparándose) con ese
     * delegado.
     */
    prewarm(delegate: PreferredDelegate = 'GPU'): void {
        if (this.pooled !== null) {
            if (this.pooled.delegate === delegate || this.pooledLeased) {
                return;
            }

            this.disposePooled();
        }

        this.pooled = this.create(delegate);
        this.scheduleExpiry();
        this.notifyStateChange();
    }

    /** Presta un motor para una sesión: el caliente si sirve, o uno nuevo. */
    acquire(delegate: PreferredDelegate): RuntimeLease {
        const pooled = this.pooled;

        if (
            pooled !== null &&
            !this.pooledLeased &&
            pooled.delegate === delegate
        ) {
            this.pooledLeased = true;
            this.cancelExpiry();

            return this.lease(
                pooled,
                pooled.state === 'ready' ? 'warm' : 'warming',
            );
        }

        if (pooled !== null && !this.pooledLeased) {
            // Otro delegado: el caliente ya no sirve.
            this.disposePooled();
        }

        if (this.pooled === null) {
            this.pooled = this.create(delegate);
            this.pooledLeased = true;
            this.cancelExpiry();
            this.notifyStateChange();

            return this.lease(this.pooled, 'cold');
        }

        // El del pool ya está prestado: uno aparte, que no se reutiliza.
        const runtime = this.create(delegate);

        this.extra.add(runtime);

        return this.lease(runtime, 'cold');
    }

    /**
     * "Esta página puede usar el motor": mientras haya alguien que lo
     * retenga, el motor en caliente no caduca. Devuelve la función que lo
     * suelta.
     */
    retain(): () => void {
        this.retainers++;
        this.cancelExpiry();

        let released = false;

        return () => {
            if (released) {
                return;
            }

            released = true;
            this.retainers--;
            this.scheduleExpiry();
        };
    }

    /** Libera el motor en caliente si nadie lo está usando. */
    disposeIdle(): void {
        if (this.pooled !== null && !this.pooledLeased) {
            this.disposePooled();
        }
    }

    /** Cierra todos los motores, prestados o no (recarga en desarrollo). */
    disposeAll(): void {
        this.disposePooled();

        for (const runtime of this.extra) {
            runtime.dispose();
        }

        this.extra.clear();
    }

    private create(delegate: PreferredDelegate): EngineRuntime {
        const runtime = new EngineRuntime(
            this.options.createWorker(),
            delegate,
            {
                assets: this.options.resolveAssets(),
                mediapipeVersion: this.options.mediapipeVersion,
            },
            this.scheduler,
            this.options.initTimeoutMs,
            (dead) => this.handleDeath(dead),
            () => this.notifyStateChange(),
        );

        return runtime;
    }

    private notifyStateChange(): void {
        const state = this.warmState;

        if (state === this.lastWarmState) {
            return;
        }

        this.lastWarmState = state;

        for (const listener of this.stateListeners) {
            listener();
        }
    }

    private lease(runtime: EngineRuntime, reuse: RuntimeReuse): RuntimeLease {
        let released = false;

        return {
            runtime,
            reuse,
            release: ({ discard = false } = {}) => {
                if (released) {
                    return;
                }

                released = true;
                runtime.setListener(null);
                this.giveBack(runtime, discard);
            },
        };
    }

    private giveBack(runtime: EngineRuntime, discard: boolean): void {
        if (this.extra.delete(runtime)) {
            runtime.dispose();

            return;
        }

        if (runtime !== this.pooled) {
            // Ya se había descartado (murió o se liberó todo).
            runtime.dispose();

            return;
        }

        this.pooledLeased = false;

        if (discard || runtime.state === 'dead') {
            this.disposePooled();

            return;
        }

        this.scheduleExpiry();
    }

    private handleDeath(runtime: EngineRuntime): void {
        // Uno prestado se limpia al devolverlo.
        if (runtime === this.pooled && !this.pooledLeased) {
            this.pooled = null;
            this.cancelExpiry();
        }

        this.notifyStateChange();
    }

    private disposePooled(): void {
        this.cancelExpiry();
        this.pooled?.dispose();
        this.pooled = null;
        this.pooledLeased = false;
        this.notifyStateChange();
    }

    private scheduleExpiry(): void {
        this.cancelExpiry();

        if (this.pooled === null || this.pooledLeased || this.retainers > 0) {
            return;
        }

        this.expiryTimer = this.scheduler.setTimeout(() => {
            this.expiryTimer = null;
            this.disposeIdle();
        }, this.options.keepWarmMs);
    }

    private cancelExpiry(): void {
        if (this.expiryTimer !== null) {
            this.scheduler.clearTimeout(this.expiryTimer);
            this.expiryTimer = null;
        }
    }
}
