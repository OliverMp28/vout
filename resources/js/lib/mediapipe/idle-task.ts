/**
 * Ejecuta una tarea de fondo (una precarga) cuando conviene: con la pestaña
 * visible y el navegador libre. Una pestaña abierta en segundo plano no gasta
 * nada hasta que el usuario la mira.
 *
 * El entorno (temporizadores, `requestIdleCallback`, `document`) se inyecta
 * para probarlo sin navegador.
 */

/** Sin `requestIdleCallback` (Safari), se espera esto. */
const FALLBACK_DELAY_MS = 250;

export type IdleEnvironment = {
    requestIdleCallback?: (
        callback: () => void,
        options: { timeout: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
    setTimeout: (callback: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
    document: {
        visibilityState: DocumentVisibilityState;
        addEventListener: (
            type: 'visibilitychange',
            listener: () => void,
        ) => void;
        removeEventListener: (
            type: 'visibilitychange',
            listener: () => void,
        ) => void;
    };
};

function browserEnvironment(): IdleEnvironment {
    return {
        requestIdleCallback:
            typeof window.requestIdleCallback === 'function'
                ? (callback, options) =>
                      window.requestIdleCallback(callback, options)
                : undefined,
        cancelIdleCallback:
            typeof window.cancelIdleCallback === 'function'
                ? (handle) => window.cancelIdleCallback(handle)
                : undefined,
        setTimeout: (callback, ms) => window.setTimeout(callback, ms),
        clearTimeout: (handle) =>
            window.clearTimeout(handle as number | undefined),
        document,
    };
}

/**
 * Programa `task` para cuando la pestaña esté visible y el navegador libre
 * (como mucho `timeoutMs` después).
 *
 * @returns La función que la cancela si aún no se ejecutó.
 */
export function runWhenIdle(
    task: () => void,
    timeoutMs: number,
    environment: IdleEnvironment = browserEnvironment(),
): () => void {
    let cancelScheduled: (() => void) | null = null;
    let done = false;

    const run = () => {
        cancelScheduled = null;

        if (!done) {
            done = true;
            task();
        }
    };

    const schedule = () => {
        const { requestIdleCallback, cancelIdleCallback } = environment;

        if (requestIdleCallback !== undefined) {
            const handle = requestIdleCallback(run, { timeout: timeoutMs });

            cancelScheduled = () => cancelIdleCallback?.(handle);

            return;
        }

        const handle = environment.setTimeout(run, FALLBACK_DELAY_MS);

        cancelScheduled = () => environment.clearTimeout(handle);
    };

    const onVisibilityChange = () => {
        if (environment.document.visibilityState === 'visible') {
            environment.document.removeEventListener(
                'visibilitychange',
                onVisibilityChange,
            );
            schedule();
        }
    };

    if (environment.document.visibilityState === 'visible') {
        schedule();
    } else {
        environment.document.addEventListener(
            'visibilitychange',
            onVisibilityChange,
        );
    }

    return () => {
        done = true;
        environment.document.removeEventListener(
            'visibilitychange',
            onVisibilityChange,
        );
        cancelScheduled?.();
        cancelScheduled = null;
    };
}
