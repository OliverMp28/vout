import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
    document.addEventListener('visibilitychange', callback);

    return () => document.removeEventListener('visibilitychange', callback);
}

function isVisible(): boolean {
    return document.visibilityState === 'visible';
}

function getServerSnapshot(): boolean {
    return true;
}

/** Si la pestaña se ve (no está oculta tras otra ni minimizada). */
export function usePageVisible(): boolean {
    return useSyncExternalStore(subscribe, isVisible, getServerSnapshot);
}
