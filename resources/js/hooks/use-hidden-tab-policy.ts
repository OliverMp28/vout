/**
 * Conecta `lib/play/hidden-tab.ts` con la visibilidad de la pestaña: pausa al
 * ocultarla, reanuda al volver pronto y apaga la cámara tras 1 minuto oculta.
 */

import { useEffect, useRef } from 'react';

import { realScheduler } from '@/lib/mediapipe/scheduler';
import { createHiddenTabPolicy } from '@/lib/play/hidden-tab';

type HiddenTabHandlers = {
    onHide: () => void;
    onLongHidden: () => void;
    onReturn: (kind: 'short' | 'long') => void;
};

export function useHiddenTabPolicy(handlers: HiddenTabHandlers): void {
    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    });

    useEffect(() => {
        const policy = createHiddenTabPolicy({
            scheduler: realScheduler,
            wallClock: () => Date.now(),
            onHide: () => handlersRef.current.onHide(),
            onLongHidden: () => handlersRef.current.onLongHidden(),
            onReturn: (kind) => handlersRef.current.onReturn(kind),
        });

        const onVisibilityChange = (): void =>
            policy.visibilityChanged(document.visibilityState === 'hidden');

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange,
            );
            policy.dispose();
        };
    }, []);
}
