/**
 * Qué hacer con la cámara cuando la pestaña del juego queda oculta.
 *
 * Con la pestaña oculta el navegador deja de dar imágenes, pero la cámara
 * sigue encendida (con su luz). Así que:
 *
 *   - Al ocultarla, el análisis se pausa (`onHide`).
 *   - Si vuelve antes de `longHiddenMs`, sigue donde estaba
 *     (`onReturn('short')`).
 *   - Si pasa `longHiddenMs` oculta, se apaga la cámara (`onLongHidden`) y al
 *     volver se avisa (`onReturn('long')`).
 *
 * Con la pestaña oculta o el equipo dormido los temporizadores se retrasan o
 * se congelan: al volver se compara también la hora real, por si el aviso
 * no llegó a tiempo.
 *
 * Sin DOM ni React: el reloj y la hora real se inyectan.
 */

import type { Scheduler, TimerHandle } from '@/lib/mediapipe/scheduler';

/** Tiempo oculta tras el que se apaga la cámara. */
export const CAMERA_HIDDEN_STOP_MS = 60_000;

export type HiddenTabPolicyOptions = {
    scheduler: Scheduler;
    /** Hora real en ms (`Date.now`): sigue contando con el equipo dormido. */
    wallClock: () => number;
    longHiddenMs?: number;
    onHide: () => void;
    onLongHidden: () => void;
    onReturn: (kind: 'short' | 'long') => void;
};

export type HiddenTabPolicy = {
    /** Avisa de que la pestaña se ocultó (`true`) o volvió a verse. */
    visibilityChanged: (hidden: boolean) => void;
    dispose: () => void;
};

export function createHiddenTabPolicy({
    scheduler,
    wallClock,
    longHiddenMs = CAMERA_HIDDEN_STOP_MS,
    onHide,
    onLongHidden,
    onReturn,
}: HiddenTabPolicyOptions): HiddenTabPolicy {
    let hiddenAt: number | null = null;
    let longFired = false;
    let timer: TimerHandle | null = null;

    const clearTimer = (): void => {
        if (timer !== null) {
            scheduler.clearTimeout(timer);
            timer = null;
        }
    };

    const fireLong = (): void => {
        if (longFired) {
            return;
        }

        longFired = true;
        onLongHidden();
    };

    return {
        visibilityChanged(hidden) {
            if (hidden) {
                if (hiddenAt !== null) {
                    return;
                }

                hiddenAt = wallClock();
                longFired = false;
                onHide();
                timer = scheduler.setTimeout(() => {
                    timer = null;
                    fireLong();
                }, longHiddenMs);

                return;
            }

            if (hiddenAt === null) {
                return;
            }

            clearTimer();

            if (wallClock() - hiddenAt >= longHiddenMs) {
                fireLong();
            }

            hiddenAt = null;
            onReturn(longFired ? 'long' : 'short');
        },
        dispose() {
            clearTimer();
            hiddenAt = null;
        },
    };
}
