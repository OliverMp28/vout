/**
 * Qué ofrece la página de juego según el usuario y el juego. Es la única
 * decisión de la página sobre el control facial: los componentes solo pintan
 * lo que dice aquí.
 *
 *   - Un juego que no recibe los controles de Vout no ofrece la cámara (no
 *     haría nada). A quien usa la cámara se le dice por qué no está.
 *   - A quien no la usa se le ofrece de forma discreta: el botón "Control
 *     facial" y, si le habla, Vou. Sin perfil de gestos puede probarla sin
 *     configurar nada ("Probar ahora").
 *   - El panel sale abierto para quien juega con la cámara y cerrado para el
 *     resto, salvo que el usuario lo dejara de otra forma (se recuerda).
 *
 * Sin DOM ni React.
 */

import type { FacialControlSupport, FacialControlUsage } from '@/types';

/** Lo que la página de juego lee de los ajustes del usuario. */
export type PlayPreferences = {
    usage: FacialControlUsage;
    /** La cámara se enciende sola en los juegos compatibles. */
    autostart: boolean;
    /** Panel abierto o cerrado a mano; null, lo que diga el perfil. */
    panelOpen: boolean | null;
    /** Ver la cámara mientras se juega. */
    showCameraPreview: boolean;
};

type SettingsLike = {
    facial_control_usage?: FacialControlUsage | null;
    camera_autostart?: boolean | null;
    play_panel_open?: boolean | null;
    show_camera_preview?: boolean | null;
};

/** Las preferencias, con valores por defecto si aún no hay ajustes guardados. */
export function readPlayPreferences(
    settings: SettingsLike | null | undefined,
): PlayPreferences {
    const usage = settings?.facial_control_usage ?? 'off';

    return {
        usage,
        autostart: usage === 'primary' && settings?.camera_autostart === true,
        panelOpen: settings?.play_panel_open ?? null,
        showCameraPreview: settings?.show_camera_preview === true,
    };
}

export type PlayModeInput = {
    usage: FacialControlUsage;
    support: FacialControlSupport;
    /** Tiene un perfil de gestos guardado. */
    hasProfile: boolean;
    /** Cómo dejó el panel el usuario (null: nunca lo tocó). */
    panelPreference: boolean | null;
};

export type PlayMode = {
    /** Se ofrece el control facial en este juego. */
    cameraAvailable: boolean;
    /** El panel sale abierto (en escritorio). */
    panelOpenByDefault: boolean;
    /** Invitar con discreción a probarlo (quien no usa la cámara). */
    inviteToTry: boolean;
    /** Sin perfil de gestos: se prueba con los controles por defecto, sin guardar. */
    trialOnly: boolean;
    /** Decir que este juego no admite el control facial (a quien lo usa). */
    showUnsupportedNotice: boolean;
    /** Botón rápido "Activar cámara" en la cabecera (quien juega con ella). */
    quickActivate: boolean;
};

export function decidePlayMode({
    usage,
    support,
    hasProfile,
    panelPreference,
}: PlayModeInput): PlayMode {
    const cameraAvailable = support !== 'none';
    const usesCamera = usage !== 'off';

    return {
        cameraAvailable,
        panelOpenByDefault:
            cameraAvailable && (panelPreference ?? usage === 'primary'),
        inviteToTry: cameraAvailable && !usesCamera,
        trialOnly: !hasProfile,
        showUnsupportedNotice: !cameraAvailable && usesCamera,
        quickActivate: cameraAvailable && usage === 'primary',
    };
}

/**
 * Dónde se ve la cámara (solo puede estar en un sitio: el worker pinta en el
 * último lienzo que se le da).
 *
 * - `panel` → dentro del panel abierto.
 * - `stage` → miniatura sobre el juego (panel cerrado o pantalla completa).
 */
export type PreviewSlot = 'panel' | 'stage' | null;

export function previewSlot({
    previewEnabled,
    engineActive,
    panelVisible,
    fullscreen = false,
}: {
    previewEnabled: boolean;
    /** El motor está en marcha (sin él no hay imagen). */
    engineActive: boolean;
    /** El panel se ve ahora mismo (abierto en escritorio o la hoja en móvil). */
    panelVisible: boolean;
    fullscreen?: boolean;
}): PreviewSlot {
    if (!previewEnabled || !engineActive) {
        return null;
    }

    return panelVisible && !fullscreen ? 'panel' : 'stage';
}
