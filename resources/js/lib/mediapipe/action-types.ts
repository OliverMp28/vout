/**
 * Sistema de tipos para la traducción de gestos a acciones de juego.
 *
 * Jerarquía:
 * - GestureType       → gestos faciales detectados por MediaPipe (blendshapes).
 * - HeadDirectionType → gestos virtuales generados por ActionDispatcher
 *                       al cruzar umbrales de posición de cabeza.
 * - ActionTrigger     → unión de ambos; es la clave del gesture_mapping.
 * - GameAction        → la acción a ejecutar (teclado, ratón, evento).
 */

import type { GestureType } from './types';

// ---------------------------------------------------------------------------
// HeadDirectionType — gestos virtuales de dirección de cabeza
// ---------------------------------------------------------------------------

/**
 * Gestos virtuales generados por ActionDispatcher cuando la posición del cursor
 * de cabeza (HeadTrackPosition) cruza los umbrales definidos.
 *
 * No son emitidos por el clasificador de MediaPipe — no tienen blendshapes.
 * Se sintetizan internamente al comparar headTrackPosition.x/y contra umbrales.
 */
export const HeadDirectionType = {
    HeadLeft: 'HEAD_LEFT',
    HeadRight: 'HEAD_RIGHT',
    HeadUp: 'HEAD_UP',
    HeadDown: 'HEAD_DOWN',
} as const;

export type HeadDirectionType = (typeof HeadDirectionType)[keyof typeof HeadDirectionType];

// ---------------------------------------------------------------------------
// ActionTrigger — identificador unificado para las claves del gesture_mapping
// ---------------------------------------------------------------------------

/** Puede ser un gesto facial (GestureType) o una dirección de cabeza virtual (HeadDirectionType). */
export type ActionTrigger = GestureType | HeadDirectionType;

// ---------------------------------------------------------------------------
// GameAction — la acción a ejecutar cuando se detecta un trigger
// ---------------------------------------------------------------------------

export type GameAction =
    | { type: 'keyboard'; key: string; mode: 'press' | 'hold' }
    | { type: 'mouse_click'; button: 'left' | 'right' }
    /**
     * Emite un CustomEvent en 3.2. En la fase 3.3, este tipo se reemplazará
     * por target.postMessage({ type: 'GAME_ACTION', event }, origin) cuando
     * el target sea un iframe.contentWindow.
     */
    | { type: 'game_event'; event: string }
    | { type: 'none' };

// ---------------------------------------------------------------------------
// HeadTrackingMode — cómo se usa el movimiento de cabeza
// ---------------------------------------------------------------------------

/**
 * - cursor:   La posición de cabeza mapea a coordenadas de ratón virtual [0,1].
 *             Los triggers HEAD_* no se activan.
 * - gesture:  La posición de cabeza genera triggers HEAD_* al cruzar umbrales.
 *             El cursor visual no se usa.
 * - disabled: El head tracking se ignora completamente.
 */
export type HeadTrackingMode = 'cursor' | 'gesture' | 'disabled';

// ---------------------------------------------------------------------------
// GestureActionMapping — estructura almacenada en gesture_configs.gesture_mapping
// ---------------------------------------------------------------------------

export type GestureActionMapping = Partial<Record<ActionTrigger, GameAction>>;

// ---------------------------------------------------------------------------
// KeyOption — lista de teclas comunes para el KeyPicker (Sesión 4)
// ---------------------------------------------------------------------------

export type KeyOption = {
    /** Etiqueta visible al usuario en la UI. */
    label: string;
    /**
     * Valor almacenado en GameAction.key — corresponde a KeyboardEvent.code.
     * Usar resolveEventKey() para obtener el KeyboardEvent.key real al despachar.
     */
    code: string;
    /** Grupo para organizar las teclas en el picker. */
    group: 'arrows' | 'wasd' | 'actions' | 'letters' | 'numbers';
};

export const COMMON_GAME_KEYS: KeyOption[] = [
    // Flechas
    { label: '↑ Up', code: 'ArrowUp', group: 'arrows' },
    { label: '↓ Down', code: 'ArrowDown', group: 'arrows' },
    { label: '← Left', code: 'ArrowLeft', group: 'arrows' },
    { label: '→ Right', code: 'ArrowRight', group: 'arrows' },
    // WASD
    { label: 'W', code: 'KeyW', group: 'wasd' },
    { label: 'A', code: 'KeyA', group: 'wasd' },
    { label: 'S', code: 'KeyS', group: 'wasd' },
    { label: 'D', code: 'KeyD', group: 'wasd' },
    // Acciones fundamentales
    { label: 'Space', code: 'Space', group: 'actions' },
    { label: 'Enter', code: 'Enter', group: 'actions' },
    { label: 'Escape', code: 'Escape', group: 'actions' },
    // Letras habituales en juegos
    { label: 'Z', code: 'KeyZ', group: 'letters' },
    { label: 'X', code: 'KeyX', group: 'letters' },
    { label: 'C', code: 'KeyC', group: 'letters' },
    { label: 'R', code: 'KeyR', group: 'letters' },
    { label: 'F', code: 'KeyF', group: 'letters' },
    { label: 'E', code: 'KeyE', group: 'letters' },
    { label: 'Q', code: 'KeyQ', group: 'letters' },
    // Números
    { label: '1', code: 'Digit1', group: 'numbers' },
    { label: '2', code: 'Digit2', group: 'numbers' },
    { label: '3', code: 'Digit3', group: 'numbers' },
    { label: '4', code: 'Digit4', group: 'numbers' },
];

// ---------------------------------------------------------------------------
// resolveEventKey — convierte GameAction.key (code) → KeyboardEvent.key
// ---------------------------------------------------------------------------

/**
 * Convierte el valor almacenado en GameAction.key (que sigue el formato
 * KeyboardEvent.code) al valor correcto para KeyboardEvent.key al despachar.
 *
 * Ejemplos:
 *   'Space'     → ' '         (key = espacio literal)
 *   'ArrowLeft' → 'ArrowLeft' (key = code, sin cambio)
 *   'KeyA'      → 'a'         (key = letra minúscula)
 *   'Digit1'    → '1'         (key = carácter numérico)
 *   'Enter'     → 'Enter'     (key = code, sin cambio)
 */
export function resolveEventKey(code: string): string {
    if (code === 'Space') return ' ';
    if (code.startsWith('Key')) return code.slice(3).toLowerCase();
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
}

// ---------------------------------------------------------------------------
// Normalización del formato legacy
// ---------------------------------------------------------------------------

/**
 * Mapa de nombres de acción del formato antiguo a GameAction enriquecido.
 * Se usa en normalizeGestureMapping para migrar datos existentes en BD.
 */
const LEGACY_ACTION_MAP: Partial<Record<string, GameAction>> = {
    JUMP: { type: 'keyboard', key: 'Space', mode: 'press' },
    SHOOT: { type: 'mouse_click', button: 'left' },
    MOVE_LEFT: { type: 'keyboard', key: 'ArrowLeft', mode: 'hold' },
    MOVE_RIGHT: { type: 'keyboard', key: 'ArrowRight', mode: 'hold' },
    MOVE_UP: { type: 'keyboard', key: 'ArrowUp', mode: 'hold' },
    MOVE_DOWN: { type: 'keyboard', key: 'ArrowDown', mode: 'hold' },
    ATTACK: { type: 'keyboard', key: 'KeyZ', mode: 'press' },
    DODGE: { type: 'keyboard', key: 'KeyX', mode: 'press' },
    PAUSE: { type: 'keyboard', key: 'Escape', mode: 'press' },
    SELECT: { type: 'keyboard', key: 'Enter', mode: 'press' },
};

/**
 * Devuelve true si el mapping usa el formato legacy donde los valores son
 * strings planos (ej. "JUMP") en lugar de objetos GameAction.
 */
export function isLegacyMapping(raw: unknown): boolean {
    if (typeof raw !== 'object' || raw === null) return false;
    const values = Object.values(raw as Record<string, unknown>);
    return values.length > 0 && values.some((v) => typeof v === 'string');
}

/**
 * Normaliza un mapping del formato legacy { "BROW_RAISE": "JUMP" } al formato
 * enriquecido { "BROW_RAISE": { type: 'keyboard', key: 'Space', mode: 'press' } }.
 *
 * Reglas de conversión:
 * - Strings en LEGACY_ACTION_MAP → GameAction equivalente.
 * - Strings desconocidos → { type: 'none' } (el usuario deberá reconfigurar).
 * - Objetos con propiedad `type` → se mantienen tal cual (ya son GameAction).
 * - Valores inválidos → se omiten silenciosamente.
 */
export function normalizeGestureMapping(raw: unknown): GestureActionMapping {
    if (typeof raw !== 'object' || raw === null) return {};

    const result: GestureActionMapping = {};

    for (const [trigger, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value === 'string') {
            result[trigger as ActionTrigger] = LEGACY_ACTION_MAP[value] ?? { type: 'none' };
        } else if (typeof value === 'object' && value !== null && 'type' in value) {
            result[trigger as ActionTrigger] = value as GameAction;
        }
    }

    return result;
}
