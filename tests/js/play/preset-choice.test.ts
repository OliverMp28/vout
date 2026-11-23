import { describe, expect, test } from 'bun:test';

import { OWN_CONTROLS, resolvePresetChoice } from '@/lib/play/preset-choice';

describe('resolvePresetChoice', () => {
    test('si el juego no sugiere nada, los controles propios sin preguntar', () => {
        expect(
            resolvePresetChoice({
                suggested: null,
                stored: null,
                trial: false,
            }),
        ).toEqual({
            gamePreset: null,
            ask: false,
        });
    });

    test('la primera vez se pregunta (y mientras, los propios)', () => {
        expect(
            resolvePresetChoice({
                suggested: 'runner',
                stored: null,
                trial: false,
            }),
        ).toEqual({
            gamePreset: null,
            ask: true,
        });
    });

    test('si ya aceptó los del juego, se usan sin preguntar', () => {
        expect(
            resolvePresetChoice({
                suggested: 'runner',
                stored: 'runner',
                trial: false,
            }),
        ).toEqual({
            gamePreset: 'runner',
            ask: false,
        });
    });

    test('si se quedó con los suyos, no se vuelve a preguntar', () => {
        expect(
            resolvePresetChoice({
                suggested: 'runner',
                stored: OWN_CONTROLS,
                trial: false,
            }),
        ).toEqual({
            gamePreset: null,
            ask: false,
        });
    });

    test('si el juego cambió su sugerencia, se pregunta de nuevo', () => {
        expect(
            resolvePresetChoice({
                suggested: 'shooter',
                stored: 'runner',
                trial: false,
            }),
        ).toEqual({
            gamePreset: null,
            ask: true,
        });
    });

    test('en la prueba sin perfil se usan los del juego sin preguntar', () => {
        expect(
            resolvePresetChoice({
                suggested: 'runner',
                stored: null,
                trial: true,
            }),
        ).toEqual({
            gamePreset: 'runner',
            ask: false,
        });
    });
});
