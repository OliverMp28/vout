/**
 * Qué guarda el asistente de calibración al terminar.
 *
 * - **Perfil nuevo:** el perfil completo, con el preset de plataformas como
 *   mapeo de partida (se personaliza después en el editor de mapeo).
 * - **Reconfigurar un perfil existente:** solo la sensibilidad (y que quede
 *   activo). El asistente no toca el mapeo: antes lo machacaba con el de
 *   plataformas y se perdía lo personalizado en el editor.
 *
 * Sin DOM ni React.
 */

import { PRESET_PLATFORMER } from './action-presets';
import type { GestureActionMapping, HeadTrackingMode } from './action-types';

export type CalibrationPayloadInput = {
    /** El usuario ya tiene un perfil activo (el asistente lo actualiza). */
    hasExistingProfile: boolean;
    existingProfileName?: string | null;
    sensitivity: number;
};

export type NewProfilePayload = {
    profile_name: string;
    detection_mode: 'face_landmarks';
    sensitivity: number;
    gesture_mapping: GestureActionMapping;
    head_tracking_mode: HeadTrackingMode;
    is_active: true;
};

export type ProfileUpdatePayload = {
    sensitivity: number;
    is_active: true;
};

/** Nombre del perfil que crea el asistente. */
export const DEFAULT_PROFILE_NAME = 'Default';

export function buildCalibrationPayload({
    hasExistingProfile,
    existingProfileName,
    sensitivity,
}: CalibrationPayloadInput): NewProfilePayload | ProfileUpdatePayload {
    if (hasExistingProfile) {
        return { sensitivity, is_active: true };
    }

    return {
        profile_name: existingProfileName ?? DEFAULT_PROFILE_NAME,
        detection_mode: 'face_landmarks',
        sensitivity,
        gesture_mapping: PRESET_PLATFORMER.mapping,
        head_tracking_mode: PRESET_PLATFORMER.headTrackingMode,
        is_active: true,
    };
}
