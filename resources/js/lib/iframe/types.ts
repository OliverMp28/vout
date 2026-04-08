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
 * | Dirección       | Tipo         | Quién envía            |
 * |-----------------|--------------|------------------------|
 * | iframe → Vout   | READY        | Juego (al inicializar) |
 * | iframe → Vout   | GAME_STATE   | Juego (futuro)         |
 * | Vout → iframe   | VOUT_AUTH    | Portal (tras READY)    |
 * | Vout → iframe   | VOUT_ACTION  | ActionDispatcher       |
 * | Vout → iframe   | VOUT_CURSOR  | HeadTracker (modo cursor) |
 *
 * Sin dependencias de DOM ni React — utilizable en workers o tests.
 */

// ---------------------------------------------------------------------------
// Vout → Game (mensajes que el portal ENVÍA al iframe)
// ---------------------------------------------------------------------------

/**
 * Identidad del usuario autenticado, enviada tras la validación del READY.
 *
 * El token es un Personal Access Token de Passport con scope `game:play` y
 * TTL de 60 minutos. El juego debe validarlo localmente con la clave pública
 * RS256 expuesta por Vout — nunca consultar la base de datos del portal.
 */
export type VoutAuthMessage = {
    type: 'VOUT_AUTH';
    token: string;
    voutId: string;
    username: string;
};

/**
 * Acción de juego abstracta despachada por ActionDispatcher cuando el mapeo
 * activo es `{ type: 'game_event', event: '...' }`. El juego es libre de
 * interpretar el evento (ej. 'ATTACK', 'JUMP_DOUBLE') según su lógica.
 */
export type VoutActionMessage = {
    type: 'VOUT_ACTION';
    event: string;
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

export type VoutToGameMessage = VoutAuthMessage | VoutActionMessage | VoutCursorMessage;

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

export type GameToVoutMessage = GameReadyMessage | GameStateMessage;

// ---------------------------------------------------------------------------
// Estado del handshake (consumido por componentes UI)
// ---------------------------------------------------------------------------

/**
 * - `waiting`        → iframe aún no envió READY.
 * - `ready`          → READY recibido y validado, a punto de enviar AUTH.
 * - `authenticated`  → AUTH enviado correctamente, sesión activa.
 * - `error`          → fallo en validación de origen, token ausente o iframe inválido.
 */
export type HandshakeStatus = 'waiting' | 'ready' | 'authenticated' | 'error';

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
            return ready.suggestedPreset === undefined || typeof ready.suggestedPreset === 'string';
        }
        case 'GAME_STATE': {
            const state = candidate as { state?: unknown; score?: unknown };
            const validState = state.state === 'playing' || state.state === 'paused' || state.state === 'ended';
            const validScore = state.score === undefined || typeof state.score === 'number';
            return validState && validScore;
        }
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
export function isOriginAllowed(origin: string, allowedOrigins: readonly string[]): boolean {
    return allowedOrigins.includes(origin);
}
