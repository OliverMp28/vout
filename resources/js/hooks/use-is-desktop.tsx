import { useSyncExternalStore } from 'react';

/** Desde aquí el panel de la página de juego va en una columna (`lg`). */
const DESKTOP_BREAKPOINT = 1024;

const mql =
    typeof window === 'undefined'
        ? undefined
        : window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

function mediaQueryListener(callback: (event: MediaQueryListEvent) => void) {
    if (!mql) {
        return () => {};
    }

    mql.addEventListener('change', callback);

    return () => {
        mql.removeEventListener('change', callback);
    };
}

function isDesktop(): boolean {
    return mql?.matches ?? false;
}

function getServerSnapshot(): boolean {
    return false;
}

/** Si la ventana tiene ancho de escritorio (`lg` de Tailwind). */
export function useIsDesktop(): boolean {
    return useSyncExternalStore(
        mediaQueryListener,
        isDesktop,
        getServerSnapshot,
    );
}
