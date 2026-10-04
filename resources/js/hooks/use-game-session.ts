/**
 * Mantiene vigente el token de la sesión de juego embebido.
 *
 * Un juego dentro del iframe no puede renovar su token por su cuenta: sus
 * cookies no viajan en contexto third-party, así que no tiene refresh token
 * que usar. La autoridad es la sesión web del usuario en Vout, y es el portal
 * quien pide un token nuevo antes de que caduque el anterior. Cuando este
 * hook devuelve una sesión distinta, `useIframeHandshake` la reenvía al
 * juego con otro `VOUT_AUTH`.
 *
 * Comportamiento:
 * - Renueva `RENEWAL_MARGIN_MS` antes de `expiresAt`.
 * - Al volver a la pestaña comprueba el reloj real: los timers se congelan
 *   o se retrasan con el equipo suspendido o la pestaña en segundo plano.
 * - Fallos transitorios (red, 5xx, 429) → reintento con espera creciente.
 * - Respuesta terminal (401, 403, 404, 419) → deja de renovar: la sesión
 *   web caducó, el usuario revocó la app o el juego ya no está disponible.
 *
 * Efecto colateral buscado: cada renovación toca la sesión web, así que una
 * partida larga no desconecta al usuario del portal.
 */

import { useEffect, useState } from 'react';

import type { GameSession } from '@/lib/iframe/types';
import { store as sessionTokenStore } from '@/routes/play/token';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Antelación con la que se pide el token nuevo respecto a `expiresAt`. */
const RENEWAL_MARGIN_MS = 5 * 60 * 1000;

/**
 * Espera mínima entre renovaciones programadas. Evita un bucle de
 * peticiones si el servidor emitiera tokens con una TTL menor que el margen.
 */
const MIN_RENEWAL_DELAY_MS = 10 * 1000;

/** Esperas entre reintentos tras un fallo transitorio; la última se repite. */
const RETRY_DELAYS_MS = [15 * 1000, 30 * 1000, 60 * 1000];

/** Estados HTTP tras los que reintentar no tiene sentido. */
const TERMINAL_STATUSES: ReadonlySet<number> = new Set([401, 403, 404, 419]);

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Forma en la que el backend serializa la sesión (`GameSessionToken::toArray`). */
export type GameSessionPayload = {
    token: string;
    expires_at: number;
};

type UseGameSessionOptions = {
    /** Slug del juego: identifica el endpoint de renovación. */
    gameSlug: string;
    /** Sesión emitida por `PlayController` al cargar la página. */
    initialSession: GameSessionPayload;
};

class SessionEndedError extends Error {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGameSession(payload: GameSessionPayload): GameSession {
    return { token: payload.token, expiresAt: payload.expires_at };
}

/**
 * Lee el token CSRF de la cookie `XSRF-TOKEN` que Laravel emite en cada
 * respuesta. `fetch` no lo adjunta por sí solo (a diferencia del cliente
 * HTTP de Inertia), así que lo enviamos en la cabecera `X-XSRF-TOKEN`.
 */
function readXsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

async function requestSession(gameSlug: string): Promise<GameSession> {
    const response = await fetch(sessionTokenStore.url(gameSlug), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': readXsrfToken(),
        },
    });

    if (TERMINAL_STATUSES.has(response.status)) {
        throw new SessionEndedError(`Game session ended: ${response.status}`);
    }

    if (!response.ok) {
        throw new Error(`Game session renewal failed: ${response.status}`);
    }

    const payload: unknown = await response.json();

    if (!isGameSessionPayload(payload)) {
        throw new Error('Game session renewal returned an invalid payload');
    }

    return toGameSession(payload);
}

function isGameSessionPayload(payload: unknown): payload is GameSessionPayload {
    if (typeof payload !== 'object' || payload === null) {
        return false;
    }

    const candidate = payload as Partial<GameSessionPayload>;

    return (
        typeof candidate.token === 'string' &&
        typeof candidate.expires_at === 'number'
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameSession({
    gameSlug,
    initialSession,
}: UseGameSessionOptions): GameSession {
    const [session, setSession] = useState<GameSession>(() =>
        toGameSession(initialSession),
    );

    // Una visita nueva a /play trae su propia sesión: descartamos la que
    // estuviéramos renovando. Patrón "storing information from previous
    // renders" de React 19, igual que en useIframeHandshake.
    const [previousInitialSession, setPreviousInitialSession] =
        useState(initialSession);
    if (previousInitialSession !== initialSession) {
        setPreviousInitialSession(initialSession);
        setSession(toGameSession(initialSession));
    }

    useEffect(() => {
        const renewAt = session.expiresAt * 1000 - RENEWAL_MARGIN_MS;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;
        let stopped = false;
        let inFlight = false;
        let failures = 0;

        async function renew(): Promise<void> {
            if (inFlight || stopped) return;
            inFlight = true;

            try {
                const nextSession = await requestSession(gameSlug);
                // La sesión nueva re-ejecuta este effect, que programa la
                // siguiente renovación a partir de su `expiresAt`.
                if (!cancelled) setSession(nextSession);
            } catch (error) {
                if (cancelled) return;

                if (error instanceof SessionEndedError) {
                    stopped = true;
                    return;
                }

                const retryDelay =
                    RETRY_DELAYS_MS[
                        Math.min(failures, RETRY_DELAYS_MS.length - 1)
                    ];
                failures += 1;
                timer = setTimeout(() => void renew(), retryDelay);
            } finally {
                inFlight = false;
            }
        }

        function renewIfDue(): void {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() < renewAt) return;

            if (timer) clearTimeout(timer);
            void renew();
        }

        timer = setTimeout(
            () => void renew(),
            Math.max(renewAt - Date.now(), MIN_RENEWAL_DELAY_MS),
        );
        document.addEventListener('visibilitychange', renewIfDue);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener('visibilitychange', renewIfDue);
        };
    }, [session, gameSlug]);

    return session;
}
