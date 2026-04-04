/**
 * Presets de mapeo de gestos predefinidos.
 *
 * Cada preset incluye un mapping completo y el modo de head tracking recomendado.
 * El usuario puede seleccionar un preset como punto de partida y luego ajustarlo
 * en el GestureMappingEditor (Sesión 4).
 */

import { HeadDirectionType } from './action-types';
import type { GestureActionMapping, HeadTrackingMode } from './action-types';
import { GestureType } from './types';

// ---------------------------------------------------------------------------
// Tipo de preset
// ---------------------------------------------------------------------------

export type ActionPreset = {
    /** Clave i18n para el nombre visible al usuario. */
    nameKey: string;
    /** Mapeo de triggers a acciones. */
    mapping: GestureActionMapping;
    /** Modo de head tracking recomendado para este preset. */
    headTrackingMode: HeadTrackingMode;
};

// ---------------------------------------------------------------------------
// PRESET_PLATFORMER — juegos de plataformas (ej. Super Mario, Dino)
// ---------------------------------------------------------------------------

/**
 * Movimiento horizontal con la cabeza (hold), acciones discretas con gestos faciales.
 * Ideal para juegos 2D con desplazamiento lateral.
 */
export const PRESET_PLATFORMER: ActionPreset = {
    nameKey: 'vision.preset.platformer',
    headTrackingMode: 'gesture',
    mapping: {
        [GestureType.BrowRaise]: { type: 'keyboard', key: 'Space', mode: 'press' },       // Saltar
        [GestureType.MouthOpen]: { type: 'keyboard', key: 'ArrowDown', mode: 'press' },   // Agacharse
        [GestureType.BlinkLeft]: { type: 'keyboard', key: 'KeyZ', mode: 'press' },        // Atacar
        [GestureType.BlinkRight]: { type: 'keyboard', key: 'KeyX', mode: 'press' },       // Especial
        [GestureType.Smile]: { type: 'keyboard', key: 'KeyC', mode: 'press' },            // Acción extra
        [HeadDirectionType.HeadLeft]: { type: 'keyboard', key: 'ArrowLeft', mode: 'hold' },   // Mover izquierda
        [HeadDirectionType.HeadRight]: { type: 'keyboard', key: 'ArrowRight', mode: 'hold' }, // Mover derecha
    },
};

// ---------------------------------------------------------------------------
// PRESET_SHOOTER — juegos de disparos (apuntado con cabeza + disparo facial)
// ---------------------------------------------------------------------------

/**
 * La cabeza controla el cursor de apuntado (modo cursor).
 * Los gestos faciales gestionan disparar, recargar e interactuar.
 */
export const PRESET_SHOOTER: ActionPreset = {
    nameKey: 'vision.preset.shooter',
    headTrackingMode: 'cursor',
    mapping: {
        [GestureType.MouthOpen]: { type: 'mouse_click', button: 'left' },                 // Disparar
        [GestureType.BrowRaise]: { type: 'keyboard', key: 'Space', mode: 'press' },       // Saltar/Esquivar
        [GestureType.BlinkLeft]: { type: 'keyboard', key: 'KeyR', mode: 'press' },        // Recargar
        [GestureType.BlinkRight]: { type: 'keyboard', key: 'KeyF', mode: 'press' },       // Interactuar
        [GestureType.Smile]: { type: 'keyboard', key: 'KeyQ', mode: 'press' },            // Cambiar arma
        [GestureType.BrowFrown]: { type: 'keyboard', key: 'Escape', mode: 'press' },      // Pausa
    },
};

// ---------------------------------------------------------------------------
// PRESET_ACCESSIBLE — diseñado para máxima accesibilidad motora
// ---------------------------------------------------------------------------

/**
 * Solo gestos faciales simples + cabeza para direcciones.
 * Sin parpadeos ni gestos complejos que puedan causar fatiga.
 * Ideal para usuarios con movilidad reducida.
 */
export const PRESET_ACCESSIBLE: ActionPreset = {
    nameKey: 'vision.preset.accessible',
    headTrackingMode: 'gesture',
    mapping: {
        [GestureType.BrowRaise]: { type: 'keyboard', key: 'Space', mode: 'press' },       // Acción principal
        [GestureType.MouthOpen]: { type: 'keyboard', key: 'Enter', mode: 'press' },       // Confirmar
        [GestureType.Smile]: { type: 'keyboard', key: 'ArrowUp', mode: 'press' },         // Arriba/Saltar
        [GestureType.BrowFrown]: { type: 'keyboard', key: 'Escape', mode: 'press' },      // Pausa/Cancelar
        [HeadDirectionType.HeadLeft]: { type: 'keyboard', key: 'ArrowLeft', mode: 'hold' },
        [HeadDirectionType.HeadRight]: { type: 'keyboard', key: 'ArrowRight', mode: 'hold' },
        [HeadDirectionType.HeadUp]: { type: 'keyboard', key: 'ArrowUp', mode: 'hold' },
        [HeadDirectionType.HeadDown]: { type: 'keyboard', key: 'ArrowDown', mode: 'hold' },
    },
};

// ---------------------------------------------------------------------------
// Lista completa de presets para la UI
// ---------------------------------------------------------------------------

export const ALL_PRESETS: ActionPreset[] = [
    PRESET_PLATFORMER,
    PRESET_SHOOTER,
    PRESET_ACCESSIBLE,
];
