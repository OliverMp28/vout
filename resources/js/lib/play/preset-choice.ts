/**
 * Qué controles se usan en un juego que sugiere los suyos
 * (`suggestedPreset` en el READY), y si hay que preguntar.
 *
 * La respuesta se guarda por juego (`game_user.gesture_preset_choice`) para
 * no preguntar en cada partida: para quien juega sin manos, un banner que
 * hay que pulsar cada vez estorba.
 *
 * Sin DOM ni React.
 */

/** Lo guardado cuando el usuario se queda con sus controles. */
export const OWN_CONTROLS = 'own';

export type PresetChoiceInput = {
    /** Preset que sugiere el juego (ya validado: existe), o null. */
    suggested: string | null;
    /** Lo guardado para este juego, o null si nunca se preguntó. */
    stored: string | null;
    /** Sin perfil de gestos (prueba): no tiene controles propios. */
    trial: boolean;
};

export type PresetResolution = {
    /** Preset del juego a usar en lugar de los controles propios, o null. */
    gamePreset: string | null;
    /** Hay que preguntar (sugerencia nueva o que cambió). */
    ask: boolean;
};

export function resolvePresetChoice({
    suggested,
    stored,
    trial,
}: PresetChoiceInput): PresetResolution {
    if (suggested === null) {
        return { gamePreset: null, ask: false };
    }

    // En la prueba no hay controles propios: los del juego, sin preguntar.
    if (trial) {
        return { gamePreset: suggested, ask: false };
    }

    if (stored === suggested) {
        return { gamePreset: suggested, ask: false };
    }

    if (stored === OWN_CONTROLS) {
        return { gamePreset: null, ask: false };
    }

    // Nunca se preguntó, o el juego cambió su sugerencia.
    return { gamePreset: null, ask: true };
}
