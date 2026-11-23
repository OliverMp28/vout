/**
 * El encendido automático de la cámara en la página de juego: lee el
 * permiso del navegador sin pedirlo, decide qué toca (`lib/play/autostart.ts`)
 * y lleva la cuenta atrás de 3 s antes de encender.
 */

import { useEffect, useRef, useState } from 'react';

import { usePageVisible } from '@/hooks/use-page-visible';
import { realScheduler } from '@/lib/mediapipe/scheduler';
import {
    AUTOSTART_COUNTDOWN_SECONDS,
    decideAutostart,
    startCountdown,
} from '@/lib/play/autostart';
import type { AutostartState } from '@/lib/play/autostart';
import { watchCameraPermission } from '@/lib/play/camera-permission';
import type { CameraPermission } from '@/lib/play/camera-permission';

type UsePlayAutostartOptions = {
    /** El usuario lo autorizó, el juego lo admite y tiene perfil de gestos. */
    wanted: boolean;
    /** El juego terminó de cargar. */
    gameReady: boolean;
    /** El motor está parado. */
    engineIdle: boolean;
    /** Ya se encendió en esta visita (sola o a mano). */
    attempted: boolean;
    /** Enciende la cámara (como pulsar "Activar"). */
    onStart: () => void;
};

export type PlayAutostart = {
    state: AutostartState;
    /** Segundos que quedan de la cuenta atrás. */
    remaining: number;
    /** "Ahora no": no se vuelve a intentar en esta visita. */
    dismiss: () => void;
};

export function usePlayAutostart({
    wanted,
    gameReady,
    engineIdle,
    attempted,
    onStart,
}: UsePlayAutostartOptions): PlayAutostart {
    const visible = usePageVisible();
    const [permission, setPermission] = useState<CameraPermission>('pending');
    const [dismissed, setDismissed] = useState(false);
    const [remaining, setRemaining] = useState(AUTOSTART_COUNTDOWN_SECONDS);

    const onStartRef = useRef(onStart);
    useEffect(() => {
        onStartRef.current = onStart;
    });

    // El permiso puede cambiar mientras se está en la página (el usuario lo
    // concede al pulsar "Activar", o lo quita en los ajustes del sitio).
    useEffect(() => {
        if (!wanted) {
            return;
        }

        return watchCameraPermission((next) => setPermission(next));
    }, [wanted]);

    const state = decideAutostart({
        wanted,
        permission,
        visible,
        gameReady,
        engineIdle,
        dismissed,
        attempted,
    });

    useEffect(() => {
        if (state !== 'countdown') {
            return;
        }

        return startCountdown({
            seconds: AUTOSTART_COUNTDOWN_SECONDS,
            scheduler: realScheduler,
            onTick: (seconds) => setRemaining(seconds),
            onDone: () => onStartRef.current(),
        });
    }, [state]);

    return {
        state,
        remaining,
        dismiss: () => setDismissed(true),
    };
}
