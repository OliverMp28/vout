import { useEffect } from 'react';

const DEFAULT_TIMEOUT_MS = 120_000;
const THROTTLE_MS = 250;
const EVENTS = [
    'mousemove',
    'keydown',
    'scroll',
    'focusin',
    'touchstart',
] as const;

/**
 * Detecta inactividad a nivel de ventana. Dispara `onIdle` tras
 * `timeoutMs` sin actividad, y `onActive` al primer evento posterior.
 * Throttle de 250ms para evitar resets excesivos en `mousemove`.
 */
export function useIdleTimer(
    onIdle: () => void,
    onActive: () => void,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): void {
    useEffect(() => {
        let timeoutId: number | undefined;
        let throttleUntil = 0;
        let isIdle = false;

        const fireIdle = (): void => {
            isIdle = true;
            onIdle();
        };

        const armTimer = (): void => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(fireIdle, timeoutMs);
        };

        const handleActivity = (): void => {
            const now = performance.now();
            if (now < throttleUntil) {
                return;
            }
            throttleUntil = now + THROTTLE_MS;

            if (isIdle) {
                isIdle = false;
                onActive();
            }
            armTimer();
        };

        EVENTS.forEach((event) => {
            window.addEventListener(event, handleActivity, { passive: true });
        });
        armTimer();

        return () => {
            window.clearTimeout(timeoutId);
            EVENTS.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [onIdle, onActive, timeoutMs]);
}
