/**
 * Gestiona el ciclo de vida del handshake postMessage entre Vout y un iframe
 * de juego embebido.
 *
 * Responsabilidades:
 * 1. Registrar un único listener global de `message` con cleanup correcto.
 * 2. Validar `event.origin` contra la lista de orígenes permitidos del juego.
 * 3. Validar la estructura del mensaje con `isGameMessage` (defensa frente a
 *    payloads maliciosos o de extensiones del navegador).
 * 4. Tras un READY válido, responder con VOUT_AUTH al iframe usando
 *    `targetOrigin` específico (nunca `'*'`). Un juego puede repetir READY
 *    hasta recibir respuesta: cada uno se contesta con la sesión vigente.
 * 5. Reenviar VOUT_AUTH cuando la sesión se renueva (`useGameSession`), para
 *    que el juego reciba el token nuevo antes de que caduque el anterior.
 * 6. Atender EXIT: el juego pide al portal cerrar la sesión de juego.
 * 7. Exponer `sendAction` y `sendCursor` para que ActionDispatcher y el head
 *    tracker en modo cursor puedan empujar mensajes al juego una vez que la
 *    sesión está autenticada.
 *
 * Flujo:
 *   waiting ──READY válido──▶ ready ──AUTH enviado──▶ authenticated ─┐
 *      │                         │                          ▲           │
 *      │                         │                          └─ sesión ──┘
 *      │                         │                             renovada → AUTH
 *      └────error──────────────▶ error ◀──────fallo envío AUTH────┘
 *
 * Patrones React 19 (consistentes con use-action-dispatcher):
 * - `iframeRef` no se lee durante render — solo dentro de handlers/effects.
 * - Las opciones que cambian con frecuencia (token, callbacks) viven en refs
 *   internas para que el listener registrado en mount no necesite re-registrarse.
 * - Cleanup completo del listener en el return del effect.
 *
 * Uso:
 * ```typescript
 * const iframeRef = useRef<HTMLIFrameElement | null>(null);
 * const handshake = useIframeHandshake({
 *     iframeRef,
 *     allowedOrigins: game.effective_origins,
 *     session,
 *     voutId: user.vout_id,
 *     username: user.name,
 *     onReady: (preset) => preset && askApplyPreset(preset),
 *     onExit: () => router.visit(catalogUrl),
 * });
 * // handshake.status, handshake.sendAction, handshake.sendCursor, handshake.connectedOrigin
 * ```
 */

import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isGameMessage, isOriginAllowed } from '@/lib/iframe/types';
import type {
    GameSession,
    GameToVoutMessage,
    HandshakeStatus,
    VoutToGameMessage,
} from '@/lib/iframe/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type UseIframeHandshakeOptions = {
    /** Ref al elemento iframe en el DOM. Puede ser null durante el primer render. */
    iframeRef: RefObject<HTMLIFrameElement | null>;
    /**
     * Orígenes permitidos para el iframe. Generados por el backend desde
     * `Game::getEffectiveOriginsAttribute()`. Si está vacío, el handshake
     * quedará en `error` permanente y ningún mensaje será aceptado.
     */
    allowedOrigins: readonly string[];
    /**
     * Sesión de juego vigente (token + expiración), mantenida por
     * `useGameSession`. Cuando cambia tras el handshake, se reenvía al juego
     * con otro VOUT_AUTH. Si es null no se envía AUTH y el handshake queda
     * en `error`.
     */
    session: GameSession | null;
    /** UUID público del usuario (campo `vout_id` en BD). */
    voutId: string;
    /** Nombre visible del usuario para mostrar en el juego. */
    username: string;
    /**
     * Callback opcional invocado al recibir el primer READY válido de una
     * conexión, justo después de enviar VOUT_AUTH. Útil para reaccionar a
     * `suggestedPreset`. Los READY repetidos del mismo origen no lo invocan.
     */
    onReady?: (suggestedPreset?: string) => void;
    /**
     * Callback opcional invocado cuando el juego envía EXIT. El mensaje no
     * lleva destino: quien consume el hook decide a dónde navegar.
     */
    onExit?: () => void;
    /**
     * Callback opcional invocado al recibir mensajes `GAME_STATE` válidos.
     *
     * @fase3.4 — Extensión prevista:
     *   1. El juego envía `{ type: 'GAME_STATE', state, score }` al terminar o pausar.
     *   2. Este callback actualiza la tabla pivote `game_user` vía API (play_count,
     *      high_score, last_played_at).
     *   3. El backend puede emitir eventos para logros o rankings en tiempo real.
     *
     * Por ahora el handler se registra pero ningún juego de la suite lo emite aún.
     */
    onGameState?: (
        state: 'playing' | 'paused' | 'ended',
        score?: number,
    ) => void;
};

export type UseIframeHandshakeReturn = {
    /** Estado actual del handshake. Renderizable. */
    status: HandshakeStatus;
    /**
     * Origen validado del iframe tras el handshake. `null` mientras
     * `status !== 'authenticated'`. Se usa como `targetOrigin` para envíos
     * posteriores (sendAction, sendCursor).
     */
    connectedOrigin: string | null;
    /**
     * Envía un VOUT_ACTION al iframe. No-op si el handshake aún no completó.
     * Pensado para ser llamado por ActionDispatcher cuando el target es Window.
     */
    sendAction: (event: string) => void;
    /**
     * Envía un VOUT_CURSOR (coordenadas normalizadas [0,1] relativas al iframe).
     * No-op si el handshake aún no completó.
     */
    sendCursor: (x: number, y: number) => void;
    /** Resetea el handshake a 'waiting' para reintentar la conexión. */
    reset: () => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIframeHandshake(
    options: UseIframeHandshakeOptions,
): UseIframeHandshakeReturn {
    const {
        iframeRef,
        allowedOrigins,
        session,
        voutId,
        username,
        onReady,
        onExit,
        onGameState,
    } = options;

    const [status, setStatus] = useState<HandshakeStatus>('waiting');
    const [connectedOrigin, setConnectedOrigin] = useState<string | null>(null);

    // Reset por cambio de orígenes — patrón "storing information from previous
    // renders" recomendado por React 19 (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
    //
    // Si el padre pasa otra lista de orígenes (ej. navegación entre juegos sin
    // desmontar el hook), descartamos cualquier sesión previa antes del próximo
    // render para evitar enviar AUTH a un destino obsoleto. Es más eficiente
    // que hacerlo en useEffect (no provoca segundo render) y compatible con la
    // regla react-hooks/set-state-in-effect.
    const [previousAllowedOrigins, setPreviousAllowedOrigins] =
        useState(allowedOrigins);
    if (previousAllowedOrigins !== allowedOrigins) {
        setPreviousAllowedOrigins(allowedOrigins);
        setStatus('waiting');
        setConnectedOrigin(null);
    }

    // Refs sincronizadas: el listener se registra una sola vez en mount y lee
    // las opciones más recientes desde estas refs. Evita re-registros costosos
    // que podrían perder mensajes en flight.
    const allowedOriginsRef = useRef<readonly string[]>(allowedOrigins);
    const sessionRef = useRef<GameSession | null>(session);
    const voutIdRef = useRef<string>(voutId);
    const usernameRef = useRef<string>(username);
    const onReadyRef = useRef<typeof onReady>(onReady);
    const onExitRef = useRef<typeof onExit>(onExit);
    const onGameStateRef = useRef<typeof onGameState>(onGameState);
    const connectedOriginRef = useRef<string | null>(null);
    // Último token entregado al juego: evita reenviar el mismo VOUT_AUTH.
    const lastSentTokenRef = useRef<string | null>(null);

    useEffect(() => {
        allowedOriginsRef.current = allowedOrigins;
    }, [allowedOrigins]);

    useEffect(() => {
        voutIdRef.current = voutId;
    }, [voutId]);

    useEffect(() => {
        usernameRef.current = username;
    }, [username]);

    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
        onExitRef.current = onExit;
    }, [onExit]);

    useEffect(() => {
        onGameStateRef.current = onGameState;
    }, [onGameState]);

    // Envía VOUT_AUTH con la sesión vigente al origen ya validado. Devuelve
    // false si no hay iframe, no hay sesión o el envío falla.
    const postAuth = useCallback(
        (origin: string): boolean => {
            const targetWindow = iframeRef.current?.contentWindow;
            const currentSession = sessionRef.current;

            if (!targetWindow || !currentSession) {
                return false;
            }

            const authMessage: VoutToGameMessage = {
                type: 'VOUT_AUTH',
                token: currentSession.token,
                expiresAt: currentSession.expiresAt,
                voutId: voutIdRef.current,
                username: usernameRef.current,
            };

            try {
                targetWindow.postMessage(authMessage, origin);
            } catch {
                return false;
            }

            lastSentTokenRef.current = currentSession.token;

            return true;
        },
        [iframeRef],
    );

    // Renovación: cuando useGameSession entrega una sesión nueva y el juego
    // ya está conectado, se la reenviamos. El destino es el origen validado
    // en el handshake — si el iframe navegó a otro origen, el navegador
    // descarta el mensaje y el token no se filtra.
    useEffect(() => {
        sessionRef.current = session;

        const origin = connectedOriginRef.current;
        if (!session || !origin || lastSentTokenRef.current === session.token) {
            return;
        }

        postAuth(origin);
    }, [session, postAuth]);

    // Listener global de message — registrado una vez en mount.
    // Timeout: si el iframe carga pero no envía READY en 8s → 'timeout'.
    useEffect(() => {
        let readyArrived = false;
        let loadTimer: ReturnType<typeof setTimeout> | null = null;

        function onIframeLoad() {
            if (readyArrived) return;
            if (loadTimer) clearTimeout(loadTimer);
            loadTimer = setTimeout(() => {
                if (!readyArrived) {
                    setStatus('timeout');
                }
            }, 8000);
        }

        const iframe = iframeRef.current;
        iframe?.addEventListener('load', onIframeLoad);

        function handleMessage(event: MessageEvent): void {
            // 1. Validar origen contra la lista permitida.
            if (!isOriginAllowed(event.origin, allowedOriginsRef.current)) {
                return;
            }

            // 2. Validar estructura del payload.
            if (!isGameMessage(event.data)) {
                return;
            }

            // 3. Confirmar que el mensaje viene del iframe que controlamos
            //    (no de un popup o ventana hermana con el mismo origen).
            const iframe = iframeRef.current;
            if (!iframe || event.source !== iframe.contentWindow) {
                return;
            }

            const message: GameToVoutMessage = event.data;

            switch (message.type) {
                case 'READY':
                    handleReady(event.origin, message.suggestedPreset);
                    break;
                case 'GAME_STATE':
                    onGameStateRef.current?.(message.state, message.score);
                    break;
                case 'EXIT':
                    onExitRef.current?.();
                    break;
            }
        }

        function handleReady(
            origin: string,
            suggestedPreset: string | undefined,
        ): void {
            readyArrived = true;
            if (loadTimer) {
                clearTimeout(loadTimer);
                loadTimer = null;
            }

            if (!postAuth(origin)) {
                setStatus('error');
                return;
            }

            // Un juego puede repetir READY hasta recibir VOUT_AUTH. Siempre
            // respondemos, pero solo anunciamos la conexión la primera vez
            // para no reabrir, por ejemplo, una sugerencia ya descartada.
            const isFirstReady = connectedOriginRef.current !== origin;

            connectedOriginRef.current = origin;
            setConnectedOrigin(origin);
            setStatus('authenticated');

            if (isFirstReady) {
                onReadyRef.current?.(suggestedPreset);
            }
        }

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            iframe?.removeEventListener('load', onIframeLoad);
            if (loadTimer) clearTimeout(loadTimer);
        };
        // iframeRef y postAuth son estables — incluidas solo para satisfacer
        // las reglas de hooks sin causar re-suscripciones.
    }, [iframeRef, postAuth]);

    // Sincronizar el ref del origen conectado cuando React resetea el state.
    useEffect(() => {
        if (connectedOrigin === null) {
            connectedOriginRef.current = null;
        }
    }, [connectedOrigin]);

    const sendAction = useCallback(
        (eventName: string) => {
            const iframe = iframeRef.current;
            const targetWindow = iframe?.contentWindow;
            const origin = connectedOriginRef.current;

            if (!targetWindow || !origin) {
                return;
            }

            const message: VoutToGameMessage = {
                type: 'VOUT_ACTION',
                event: eventName,
            };
            targetWindow.postMessage(message, origin);
        },
        [iframeRef],
    );

    // Sesión 3.4 §5.2 — Coalescing de cursor postMessage.
    //
    // El motor de gestos puede generar 15–60 head-move events por segundo.
    // Cada uno invocaba sendCursor → postMessage individual. El juego embebido
    // no puede reaccionar a más de 1 posición por frame de su propio rAF, así
    // que los mensajes intermedios son desperdicio puro (serialización + IPC).
    //
    // Solución: almacenar la última posición y flushear una sola vez por
    // requestAnimationFrame del main thread. Resultado: máximo 60 postMessages/s
    // (o menos si el motor corre a fps inferior), sin pérdida de posición
    // porque siempre enviamos el valor más reciente.
    const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
    const cursorRafRef = useRef(0);

    const sendCursor = useCallback(
        (x: number, y: number) => {
            pendingCursorRef.current = { x, y };

            // Si ya hay un rAF pendiente, no programar otro — el flush usará
            // el valor más reciente de pendingCursorRef cuando se ejecute.
            if (cursorRafRef.current) return;

            cursorRafRef.current = requestAnimationFrame(() => {
                cursorRafRef.current = 0;
                const pending = pendingCursorRef.current;
                if (!pending) return;

                const iframe = iframeRef.current;
                const targetWindow = iframe?.contentWindow;
                const origin = connectedOriginRef.current;

                if (!targetWindow || !origin) return;

                const message: VoutToGameMessage = {
                    type: 'VOUT_CURSOR',
                    x: pending.x,
                    y: pending.y,
                };
                targetWindow.postMessage(message, origin);
            });
        },
        [iframeRef],
    );

    // Cancelar rAF pendiente del cursor al desmontar.
    useEffect(() => {
        return () => {
            if (cursorRafRef.current) {
                cancelAnimationFrame(cursorRafRef.current);
                cursorRafRef.current = 0;
            }
        };
    }, []);

    const reset = useCallback(() => {
        // Cancelar cursor pendiente — no enviar mensajes a un iframe que se va a recargar.
        if (cursorRafRef.current) {
            cancelAnimationFrame(cursorRafRef.current);
            cursorRafRef.current = 0;
        }
        pendingCursorRef.current = null;
        setStatus('waiting');
        setConnectedOrigin(null);
        connectedOriginRef.current = null;
    }, []);

    return { status, connectedOrigin, sendAction, sendCursor, reset };
}
