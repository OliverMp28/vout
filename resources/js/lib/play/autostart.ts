/**
 * Encendido automático de la cámara al abrir un juego.
 *
 * Solo para quien lo autorizó aparte en Ajustes ("Juego con la cámara" y la
 * casilla), en juegos que reciben los controles de Vout y con perfil de
 * gestos. Aun así, nunca sin avisar:
 *
 *   - Con el permiso del navegador ya dado, una cuenta atrás de 3 s con
 *     "Ahora no" (`countdown`). No hay que hacer nada para que se encienda,
 *     pero nunca pilla por sorpresa.
 *   - Sin permiso (`prompt`, o el navegador no lo dice), no se lanza el
 *     diálogo del navegador sin un clic: se explica y se ofrece el botón
 *     ya enfocado (`ask`).
 *   - Con la cámara bloqueada en el navegador, se dice cómo permitirla
 *     (`blocked`).
 *   - Espera a que el juego haya cargado y a que la pestaña se vea
 *     (`waiting`).
 *
 * Una vez por visita: tras encenderla (sola o a mano) o pulsar "Ahora no" no
 * se vuelve a intentar, salvo que se apagara por dejar la pestaña oculta.
 *
 * Sin DOM ni React.
 */

import type { Scheduler, TimerHandle } from '@/lib/mediapipe/scheduler';

import type { CameraPermission } from './camera-permission';

/** Segundos de aviso antes de encender la cámara sola. */
export const AUTOSTART_COUNTDOWN_SECONDS = 3;

export type AutostartState =
    'off' | 'waiting' | 'ask' | 'blocked' | 'countdown';

export type AutostartInput = {
    /** El usuario lo autorizó y el juego lo admite (ver arriba). */
    wanted: boolean;
    permission: CameraPermission;
    /** La pestaña se ve. */
    visible: boolean;
    /** El juego terminó de cargar (handshake hecho). */
    gameReady: boolean;
    /** El motor está parado (nadie lo ha encendido aún). */
    engineIdle: boolean;
    /** Pulsó "Ahora no" en esta visita. */
    dismissed: boolean;
    /** Ya se encendió (sola o a mano) en esta visita. */
    attempted: boolean;
};

export function decideAutostart({
    wanted,
    permission,
    visible,
    gameReady,
    engineIdle,
    dismissed,
    attempted,
}: AutostartInput): AutostartState {
    if (!wanted || dismissed || attempted || !engineIdle) {
        return 'off';
    }

    if (permission === 'pending' || !gameReady || !visible) {
        return 'waiting';
    }

    if (permission === 'denied') {
        return 'blocked';
    }

    if (permission === 'granted') {
        return 'countdown';
    }

    return 'ask';
}

/**
 * Cuenta atrás de `seconds` segundos: `onTick` con los que quedan (empieza
 * por `seconds`) y `onDone` al llegar a 0. Devuelve la función que la
 * cancela.
 */
export function startCountdown({
    seconds,
    scheduler,
    onTick,
    onDone,
}: {
    seconds: number;
    scheduler: Scheduler;
    onTick: (remaining: number) => void;
    onDone: () => void;
}): () => void {
    let handle: TimerHandle | null = null;
    let cancelled = false;

    const step = (remaining: number): void => {
        if (cancelled) {
            return;
        }

        if (remaining <= 0) {
            handle = null;
            onDone();

            return;
        }

        onTick(remaining);
        handle = scheduler.setTimeout(() => step(remaining - 1), 1000);
    };

    step(seconds);

    return () => {
        cancelled = true;

        if (handle !== null) {
            scheduler.clearTimeout(handle);
            handle = null;
        }
    };
}
