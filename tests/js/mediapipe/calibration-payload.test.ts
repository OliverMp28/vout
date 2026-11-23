import { describe, expect, test } from 'bun:test';

import { PRESET_PLATFORMER } from '@/lib/mediapipe/action-presets';
import {
    DEFAULT_PROFILE_NAME,
    buildCalibrationPayload,
} from '@/lib/mediapipe/calibration-payload';

describe('buildCalibrationPayload', () => {
    test('un perfil nuevo sale completo, con el preset de plataformas', () => {
        expect(
            buildCalibrationPayload({
                hasExistingProfile: false,
                sensitivity: 6,
            }),
        ).toEqual({
            profile_name: DEFAULT_PROFILE_NAME,
            detection_mode: 'face_landmarks',
            sensitivity: 6,
            gesture_mapping: PRESET_PLATFORMER.mapping,
            head_tracking_mode: PRESET_PLATFORMER.headTrackingMode,
            is_active: true,
        });
    });

    test('reconfigurar solo envía la sensibilidad: no toca el mapeo', () => {
        const payload = buildCalibrationPayload({
            hasExistingProfile: true,
            existingProfileName: 'Mi perfil',
            sensitivity: 4,
        });

        expect(payload).toEqual({ sensitivity: 4, is_active: true });
        expect(payload).not.toHaveProperty('gesture_mapping');
        expect(payload).not.toHaveProperty('head_tracking_mode');
    });
});
