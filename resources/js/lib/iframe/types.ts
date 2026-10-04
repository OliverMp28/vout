/**
 * Tipos del protocolo postMessage entre Vout (parent) y los juegos embebidos
 * en iframes (child).
 *
 * Reglas inamovibles del protocolo:
 * - Vout NUNCA pasa tokens por URL. Solo via postMessage tras handshake READY.
 * - Cada mensaje incluye un campo `type` discriminante.
 * - Vout valida estrictamente `event.origin` contra los allowedOrigins del juego.
 *   Mensajes con origin no autorizado son ignorados sin generar errores.
 * - Vout responde con `targetOrigin` específico (nunca `'*'`) tras la validación.
 *
 * Tabla resumen del protocolo:
 *
 * | Dirección       | Tipo         | Quién envía                          |
 * |-----------------|--------------|--------------------------------------|
 * | iframe → Vout   | READY        | Juego (al inicializar; repetible)    |
 * | iframe → Vout   | EXIT         | Juego (el usuario quiere salir)      |
 * | iframe → Vout   | GAME_STATE   | Juego (futuro)                       |
 * | Vout → iframe   | VOUT_AUTH    | Portal (tras READY y en cada renovación) |
 * | Vout → iframe   | VOUT_SESSION_END | Portal (la sesión de juego terminó) |
 * | Vout → iframe   | VOUT_ACTION  | ActionDispatcher (empieza una acción) |
 * | Vout → iframe   | VOUT_ACTION_END | ActionDispatcher (termina la acción) |
 * | Vout → iframe   | VOUT_CURSOR  | HeadTracker (modo cursor)            |
 *
 * La versión para integradores vive en `docs/integration-guide.md`
 * ("Identidad dentro del iFrame"). Cualquier cambio aquí debe reflejarse allí.
 *
 * Sin dependencias de DOM ni React — utilizable en workers o tests.
 */

// ---------------------------------------------------------------------------
// Sesión de juego (token vigente que el portal entrega al iframe)
// ---------------------------------------------------------------------------

/**
 * Token de identidad vigente para el juego embebido. Lo emite el backend
 * (`GameSessionTokenIssuer`) y `useGameSession` lo renueva antes de que
 * caduque.
 */
export type GameSession = {
    token: string;
    /** Expiración en segundos Unix (igual al claim `exp` del JWT). */
    expiresAt: number;
};

// ---------------------------------------------------------------------------
// Vout → Game (mensajes que el portal ENVÍA al iframe)
// ---------------------------------------------------------------------------

/**
 * Identidad del usuario autenticado, enviada tras la validación del READY y
 * de nuevo cada vez que el portal renueva el token (unos minutos antes de
 * que caduque el anterior). El juego debe quedarse siempre con el último.
 *
 * El token es un Access Token de Vout (JWT RS256) emitido por
 * `GameSessionTokenIssuer` con la TTL de los access tokens (60 min):
 * - Juego de una app con client OAuth → `aud` = su `client_id`, scope `user:read`.
 * - Juego sin client OAuth → token de portal con scope `game:play`.
 *
 * El juego debe validarlo localmente con la clave pública expuesta en
 * `/oauth/jwks` — nunca consultar la base de datos del portal.
 */
export type VoutAuthMessage = {
    type: 'VOUT_AUTH';
    token: string;
    /** Expiración del token en segundos Unix (igual al claim `exp`). */
    expiresAt: number;
    voutId: string;
    username: string;
};

/**
 * Motivo por el que el portal da por terminada la sesión de juego:
 * - `signed_out`  → la sesión web del usuario en Vout se cerró o caducó.
 * - `revoked`     → el usuario revocó el acceso de la app.
 * - `unavailable` → el juego dejó de estar disponible en el portal.
 */
export type VoutSessionEndReason = 'signed_out' | 'revoked' | 'unavailable';

/**
 * Aviso de que ya no llegarán más renovaciones: el juego debe soltar la
 * identidad. El portal lo sabe cuando intenta renovar, así que llega como
 * muy tarde unos minutos antes de que caduque el último token entregado.
 */
export type VoutSessionEndMessage = {
    type: 'VOUT_SESSION_END';
    reason: VoutSessionEndReason;
};

/**
 * Empieza una acción de juego. La despacha ActionDispatcher cuando el mapeo
 * activo es `{ type: 'game_event', event: '...' }`. El juego es libre de
 * interpretar el evento (ej. 'ATTACK', 'JUMP_DOUBLE') según su lógica.
 *
 * `at` es el instante, en ms Unix del reloj del navegador, del fotograma de
 * cámara en el que el portal vio empezar el gesto. Permite al juego
 * descontar el retraso de la detección.
 */
export type VoutActionMessage = {
    type: 'VOUT_ACTION';
    event: string;
    at: number;
};

/**
 * Termina la acción que abrió un `VOUT_ACTION` con el mismo `event`. Un
 * juego de toques puede ignorarlo; uno con mecánicas de "mantener" lo
 * necesita. Si varios gestos del usuario mantienen el mismo evento, solo
 * llega cuando suelta el último.
 *
 * `at` es la mejor estimación de cuándo terminó el gesto: el fotograma en
 * que la cabeza salió de la zona, o el último en que se vio el gesto facial
 * (cuyo fin se deduce por inactividad y por eso llega con retraso).
 */
export type VoutActionEndMessage = {
    type: 'VOUT_ACTION_END';
    event: string;
    at: number;
};

/**
 * Posición normalizada del cursor virtual relativa al iframe (no a la pantalla).
 * Coordenadas en rango [0, 1]: (0,0) esquina superior izquierda, (1,1) inferior
 * derecha. Calculadas por `transformCursorToIframe` antes del envío.
 */
export type VoutCursorMessage = {
    type: 'VOUT_CURSOR';
    x: number;
    y: number;
};

export type VoutToGameMessage =
    | VoutAuthMessage
    | VoutSessionEndMessage
    | VoutActionMessage
    | VoutActionEndMessage
    | VoutCursorMessage;

// ---------------------------------------------------------------------------
// Game → Vout (mensajes que el portal RECIBE del iframe)
// ---------------------------------------------------------------------------

/**
 * Señal de que el juego está listo para recibir credenciales.
 *
 * Opcionalmente puede incluir un `suggestedPreset` (ej. 'platformer') para que
 * Vout ofrezca al usuario un toast no bloqueante sugiriendo cambiar al mapeo
 * recomendado por ese juego. El cambio es solo en memoria y no se persiste.
 */
export type GameReadyMessage = {
    type: 'READY';
    suggestedPreset?: string;
};

/**
 * Reporte de estado del juego (futuro). Vout puede usarlo en Fase 4 para
 * persistir progreso, puntajes y métricas de sesión.
 */
export type GameStateMessage = {
    type: 'GAME_STATE';
    state: 'playing' | 'paused' | 'ended';
    score?: number;
};

/**
 * El juego pide al portal que cierre la sesión de juego (botón "Salir").
 *
 * No lleva destino: el portal decide a dónde navegar. Un juego embebido
 * no puede navegar la ventana superior por sí mismo (sandbox del iframe).
 */
export type GameExitMessage = {
    type: 'EXIT';
};

export type GameToVoutMessage =
    | GameReadyMessage
    | GameStateMessage
    | GameExitMessage;

// ---------------------------------------------------------------------------
// Estado del handshake (consumido por componentes UI)
// ---------------------------------------------------------------------------

/**
 * - `waiting`        → iframe aún no envió READY.
 * - `ready`          → READY recibido y validado, a punto de enviar AUTH.
 * - `authenticated`  → AUTH enviado correctamente, sesión activa.
 * - `error`          → fallo en validación de origen, token ausente o iframe inválido.
 * - `timeout`        → el iframe cargó pero no envió READY en el tiempo esperado.
 */
export type HandshakeStatus =
    | 'waiting'
    | 'ready'
    | 'authenticated'
    | 'error'
    | 'timeout';

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Comprueba si `data` es un mensaje válido del juego al portal.
 * Defensivo ante cualquier payload inesperado de un MessageEvent.
 */
export function isGameMessage(data: unknown): data is GameToVoutMessage {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    const candidate = data as { type?: unknown };
    if (typeof candidate.type !== 'string') {
        return false;
    }

    switch (candidate.type) {
        case 'READY': {
            const ready = candidate as { suggestedPreset?: unknown };
            return (
                ready.suggestedPreset === undefined ||
                typeof ready.suggestedPreset === 'string'
            );
        }
        case 'GAME_STATE': {
            const state = candidate as { state?: unknown; score?: unknown };
            const validState =
                state.state === 'playing' ||
                state.state === 'paused' ||
                state.state === 'ended';
            const validScore =
                state.score === undefined || typeof state.score === 'number';
            return validState && validScore;
        }
        case 'EXIT':
            return true;
        default:
            return false;
    }
}

// ---------------------------------------------------------------------------
// Helpers de origen
// ---------------------------------------------------------------------------

/**
 * Extrae el origen (scheme + host + puerto) de una URL absoluta.
 *
 * Útil como fallback cuando no se dispone de `effective_origins` desde el
 * backend (ej. en tests). Devuelve `null` si la URL es relativa o malformada.
 *
 * Refleja exactamente la lógica de `Game::getEffectiveOriginsAttribute()` en
 * el backend, garantizando que ambas capas calculan el mismo origen.
 */
export function extractOrigin(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

/**
 * Comprueba si un origen recibido en un MessageEvent está dentro de la lista
 * de orígenes permitidos. Comparación exacta — sin wildcards, sin subdominio
 * implícito. Coherente con la política de seguridad documentada en
 * `vout-context.md` §5.1.
 */
export function isOriginAllowed(
    origin: string,
    allowedOrigins: readonly string[],
): boolean {
    return allowedOrigins.includes(origin);
}
