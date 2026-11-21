/**
 * Reloj y temporizadores inyectables.
 *
 * Los módulos del motor (`frame-pump`, `video-frame-source`,
 * `gesture-engine`) no llaman a `performance.now()` ni a `setTimeout`
 * directamente: los reciben así, y los tests les pasan un reloj manual.
 *
 * Sin dependencias de DOM ni React.
 */

export type TimerHandle = unknown;

export type Scheduler = {
    /** Milisegundos en la línea de tiempo de `performance.now()`. */
    now(): number;
    setTimeout(callback: () => void, ms: number): TimerHandle;
    clearTimeout(handle: TimerHandle): void;
};

/** El reloj real del navegador (o del worker). */
export const realScheduler: Scheduler = {
    now: () => performance.now(),
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) =>
        globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};
