/**
 * Pantalla completa de un elemento ya existente de la página (por id, para
 * no leer refs durante el render). Fuera de él no se ve nada: lo que deba
 * seguir visible (cursor, avisos, miniatura) va dentro.
 *
 * Al entrar y al salir se avisa con `onChange` (la página devuelve el foco
 * al juego, para que la barra espaciadora no vuelva a pulsar el botón).
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
    document.addEventListener('fullscreenchange', callback);

    return () => document.removeEventListener('fullscreenchange', callback);
}

function isSupported(): boolean {
    return (
        typeof document !== 'undefined' && document.fullscreenEnabled === true
    );
}

export type Fullscreen = {
    /** El navegador deja poner elementos a pantalla completa (no en iPhone). */
    supported: boolean;
    active: boolean;
    toggle: () => void;
    exit: () => void;
};

export function useFullscreen(
    elementId: string,
    onChange?: (active: boolean) => void,
): Fullscreen {
    const active = useSyncExternalStore(
        subscribe,
        () => document.fullscreenElement?.id === elementId,
        () => false,
    );

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });

    useEffect(() => {
        const handler = (): void =>
            onChangeRef.current?.(document.fullscreenElement?.id === elementId);

        document.addEventListener('fullscreenchange', handler);

        return () => document.removeEventListener('fullscreenchange', handler);
    }, [elementId]);

    const exit = useCallback(() => {
        if (document.fullscreenElement !== null) {
            void document.exitFullscreen().catch(() => {});
        }
    }, []);

    const toggle = useCallback(() => {
        if (document.fullscreenElement?.id === elementId) {
            exit();

            return;
        }

        void document
            .getElementById(elementId)
            ?.requestFullscreen()
            .catch(() => {});
    }, [elementId, exit]);

    return { supported: isSupported(), active, toggle, exit };
}
