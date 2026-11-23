import { useEffect, useState } from 'react';

/**
 * `active`, pero solo cuando lleva `delayMs` seguido en true. Sirve para que
 * un aviso de carga no parpadee cuando la carga es casi instantánea.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
    const [elapsed, setElapsed] = useState(false);

    useEffect(() => {
        if (!active) {
            return;
        }

        const timer = setTimeout(() => setElapsed(true), delayMs);

        return () => {
            clearTimeout(timer);
            setElapsed(false);
        };
    }, [active, delayMs]);

    return active && elapsed;
}
