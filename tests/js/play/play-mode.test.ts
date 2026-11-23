import { describe, expect, test } from 'bun:test';

import {
    decidePlayMode,
    previewSlot,
    readPlayPreferences,
} from '@/lib/play/play-mode';
import type { PlayModeInput } from '@/lib/play/play-mode';

function mode(overrides: Partial<PlayModeInput> = {}) {
    return decidePlayMode({
        usage: 'occasional',
        support: 'compatible',
        hasProfile: true,
        panelPreference: null,
        ...overrides,
    });
}

describe('readPlayPreferences', () => {
    test('sin ajustes guardados: no usa la cámara y nada recordado', () => {
        expect(readPlayPreferences(null)).toEqual({
            usage: 'off',
            autostart: false,
            panelOpen: null,
            showCameraPreview: false,
        });
    });

    test('el encendido automático solo cuenta con "juego con la cámara"', () => {
        expect(
            readPlayPreferences({
                facial_control_usage: 'occasional',
                camera_autostart: true,
            }).autostart,
        ).toBeFalse();
        expect(
            readPlayPreferences({
                facial_control_usage: 'primary',
                camera_autostart: true,
            }).autostart,
        ).toBeTrue();
    });

    test('lee el panel y la vista de la cámara', () => {
        expect(
            readPlayPreferences({
                facial_control_usage: 'primary',
                play_panel_open: false,
                show_camera_preview: true,
            }),
        ).toMatchObject({ panelOpen: false, showCameraPreview: true });
    });
});

describe('decidePlayMode', () => {
    test('un juego que no admite el control facial no lo ofrece', () => {
        for (const usage of ['off', 'occasional', 'primary'] as const) {
            const result = mode({ usage, support: 'none' });

            expect(result.cameraAvailable).toBeFalse();
            expect(result.panelOpenByDefault).toBeFalse();
            expect(result.inviteToTry).toBeFalse();
            expect(result.quickActivate).toBeFalse();
        }
    });

    test('a quien usa la cámara se le dice por qué no está', () => {
        expect(
            mode({ usage: 'occasional', support: 'none' })
                .showUnsupportedNotice,
        ).toBeTrue();
        expect(
            mode({ usage: 'primary', support: 'none' }).showUnsupportedNotice,
        ).toBeTrue();
        // Quien no la usa no echa nada de menos.
        expect(
            mode({ usage: 'off', support: 'none' }).showUnsupportedNotice,
        ).toBeFalse();
        expect(
            mode({ support: 'compatible' }).showUnsupportedNotice,
        ).toBeFalse();
    });

    test('el panel sale abierto solo para quien juega con la cámara', () => {
        expect(mode({ usage: 'off' }).panelOpenByDefault).toBeFalse();
        expect(mode({ usage: 'occasional' }).panelOpenByDefault).toBeFalse();
        expect(mode({ usage: 'primary' }).panelOpenByDefault).toBeTrue();
    });

    test('cómo dejó el usuario el panel manda sobre el perfil', () => {
        expect(
            mode({ usage: 'occasional', panelPreference: true })
                .panelOpenByDefault,
        ).toBeTrue();
        expect(
            mode({ usage: 'primary', panelPreference: false })
                .panelOpenByDefault,
        ).toBeFalse();
    });

    test('se invita a probarlo a quien no usa la cámara', () => {
        expect(mode({ usage: 'off' }).inviteToTry).toBeTrue();
        expect(mode({ usage: 'occasional' }).inviteToTry).toBeFalse();
        expect(
            mode({ usage: 'primary', support: 'designed' }).inviteToTry,
        ).toBeFalse();
    });

    test('sin perfil de gestos se prueba sin guardar', () => {
        expect(mode({ hasProfile: false }).trialOnly).toBeTrue();
        expect(mode({ hasProfile: true }).trialOnly).toBeFalse();
    });

    test('el "Activar cámara" rápido es de quien juega con ella', () => {
        expect(mode({ usage: 'primary' }).quickActivate).toBeTrue();
        expect(mode({ usage: 'occasional' }).quickActivate).toBeFalse();
    });
});

describe('previewSlot', () => {
    test('sin vista activada o sin motor, en ningún sitio', () => {
        expect(
            previewSlot({
                previewEnabled: false,
                engineActive: true,
                panelVisible: true,
            }),
        ).toBeNull();
        expect(
            previewSlot({
                previewEnabled: true,
                engineActive: false,
                panelVisible: true,
            }),
        ).toBeNull();
    });

    test('en el panel si se ve; si no, sobre el juego', () => {
        expect(
            previewSlot({
                previewEnabled: true,
                engineActive: true,
                panelVisible: true,
            }),
        ).toBe('panel');
        expect(
            previewSlot({
                previewEnabled: true,
                engineActive: true,
                panelVisible: false,
            }),
        ).toBe('stage');
    });

    test('a pantalla completa, sobre el juego aunque el panel esté abierto', () => {
        expect(
            previewSlot({
                previewEnabled: true,
                engineActive: true,
                panelVisible: true,
                fullscreen: true,
            }),
        ).toBe('stage');
    });
});
