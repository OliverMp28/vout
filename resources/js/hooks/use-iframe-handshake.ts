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
 *    `targetOrigin` específico (nunca `'*'`).
 * 5. Exponer `sendAction` y `sendCursor` para que ActionDispatcher y el head
 *    tracker en modo cursor puedan empujar mensajes al juego una vez que la
 *    sesión está autenticada.
 *
 * Flujo:
 *   waiting ──READY válido──▶ ready ──AUTH enviado──▶ authenticated
 *      │                         │
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
 *     accessToken,
 *     voutId: user.vout_id,
 *     username: user.name,
 *     onReady: (preset) => preset && askApplyPreset(preset),
 * });
 * // handshake.status, handshake.sendAction, handshake.sendCursor, handshake.connectedOrigin
 * ```
 */

import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isGameMessage, isOriginAllowed } from '@/lib/iframe/types';
import type { GameToVoutMessage, HandshakeStatus, VoutToGameMessage } from '@/lib/iframe/types';

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
     * Personal Access Token de Passport con scope `game:play`. Puede ser null
     * si el usuario es invitado (en cuyo caso no se enviará AUTH).
     */
    accessToken: string | null;
    /** UUID público del usuario (campo `vout_id` en BD). */
    voutId: string;
    /** Nombre visible del usuario para mostrar en el juego. */
    username: string;
    /**
     * Callback opcional invocado al recibir un READY válido. Se llama justo
     * después de enviar VOUT_AUTH. Útil para reaccionar a `suggestedPreset`.
     */
    onReady?: (suggestedPreset?: string) => void;
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
    onGameState?: (state: 'playing' | 'paused' | 'ended', score?: number) => void;
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

export function useIframeHandshake(options: UseIframeHandshakeOptions): UseIframeHandshakeReturn {
    const { iframeRef, allowedOrigins, accessToken, voutId, username, onReady, onGameState } = options;

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
    const [previousAllowedOrigins, setPreviousAllowedOrigins] = useState(allowedOrigins);
    if (previousAllowedOrigins !== allowedOrigins) {
        setPreviousAllowedOrigins(allowedOrigins);
        setStatus('waiting');
        setConnectedOrigin(null);
    }

    // Refs sincronizadas: el listener se registra una sola vez en mount y lee
    // las opciones más recientes desde estas refs. Evita re-registros costosos
    // que podrían perder mensajes en flight.
    const allowedOriginsRef = useRef<readonly string[]>(allowedOrigins);
    const accessTokenRef = useRef<string | null>(accessToken);
    const voutIdRef = useRef<string>(voutId);
    const usernameRef = useRef<string>(username);
    const onReadyRef = useRef<typeof onReady>(onReady);
    const onGameStateRef = useRef<typeof onGameState>(onGameState);
    const connectedOriginRef = useRef<string | null>(null);

    useEffect(() => {
        allowedOriginsRef.current = allowedOrigins;
    }, [allowedOrigins]);

    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

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
        onGameStateRef.current = onGameState;
    }, [onGameState]);

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
            }
        }

        function handleReady(origin: string, suggestedPreset: string | undefined): void {
            readyArrived = true;
            if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }

            const iframe = iframeRef.current;
            const targetWindow = iframe?.contentWindow;
            const token = accessTokenRef.current;

            if (!targetWindow || !token) {
                setStatus('error');
                return;
            }

            const authMessage: VoutToGameMessage = {
                type: 'VOUT_AUTH',
                token,
                voutId: voutIdRef.current,
                username: usernameRef.current,
            };

            try {
                targetWindow.postMessage(authMessage, origin);
            } catch {
                setStatus('error');
                return;
            }

            connectedOriginRef.current = origin;
            setConnectedOrigin(origin);
            setStatus('authenticated');
            onReadyRef.current?.(suggestedPreset);
        }

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            iframe?.removeEventListener('load', onIframeLoad);
            if (loadTimer) clearTimeout(loadTimer);
        };
        // iframeRef es estable (creada con useRef) — incluida solo para
        // satisfacer las reglas de hooks sin causar re-suscripciones.
    }, [iframeRef]);

    // Sincronizar el ref del origen conectado cuando React resetea el state.
    useEffect(() => {
        if (connectedOrigin === null) {
            connectedOriginRef.current = null;
        }
    }, [connectedOrigin]);

    const sendAction = useCallback((eventName: string) => {
        const iframe = iframeRef.current;
        const targetWindow = iframe?.contentWindow;
        const origin = connectedOriginRef.current;

        if (!targetWindow || !origin) {
            return;
        }

        const message: VoutToGameMessage = { type: 'VOUT_ACTION', event: eventName };
        targetWindow.postMessage(message, origin);
    }, [iframeRef]);

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

    const sendCursor = useCallback((x: number, y: number) => {
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

            const message: VoutToGameMessage = { type: 'VOUT_CURSOR', x: pending.x, y: pending.y };
            targetWindow.postMessage(message, origin);
        });
    }, [iframeRef]);

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
