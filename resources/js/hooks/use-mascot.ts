import { useContext } from 'react';
import type { Dispatch } from 'react';
import {
    MascotContext,
    MascotDispatchContext,
} from '@/components/mascot/mascot-provider';
import type { MascotApi, MascotEvent } from '@/types/mascot';

export function useMascot(): MascotApi {
    const context = useContext(MascotContext);
    if (!context) {
        throw new Error('useMascot must be used within a MascotProvider.');
    }
    return context;
}

/**
 * Acceso al dispatcher interno de la máquina de estados.
 * Reservado al componente `<Vou />` y adaptadores futuros (MediaPipe).
 * Los consumidores externos deben usar `useMascot()`.
 */
export function useMascotDispatch(): Dispatch<MascotEvent> {
    const dispatch = useContext(MascotDispatchContext);
    if (!dispatch) {
        throw new Error(
            'useMascotDispatch must be used within a MascotProvider.',
        );
    }
    return dispatch;
}
