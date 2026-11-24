import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

import { readThemeTokens } from '../support/css-tokens';
import type { Theme } from '../support/css-tokens';
import {
    contrastRatio,
    inSrgbGamut,
    parseOklch,
    relativeLuminance,
} from '../support/oklch';

/**
 * Contraste de los tokens de color de app.css (WCAG 2.x): 4,5:1 para texto,
 * 7:1 para el texto principal y 3:1 para bordes de controles y el foco.
 * Si alguien cambia un color y rompe el contraste, falla aquí.
 */

type Pair = [foreground: string, background: string, minimum: number];

const PAIRS: Pair[] = [
    ['--foreground', '--background', 7],
    ['--foreground', '--surface-1', 7],
    ['--foreground', '--surface-2', 7],
    ['--foreground', '--surface-sunken', 7],
    ['--muted-foreground', '--background', 4.5],
    ['--muted-foreground', '--surface-1', 4.5],
    ['--muted-foreground', '--surface-sunken', 4.5],
    ['--primary-foreground', '--primary', 4.5],
    ['--foreground', '--key-light', 4.5],
    ['--signal-foreground', '--signal', 4.5],
    ['--foreground', '--signal-soft', 4.5],
    ['--success-foreground', '--success', 4.5],
    ['--warning-foreground', '--warning', 4.5],
    ['--danger-foreground', '--danger', 4.5],
    ['--info-foreground', '--info', 4.5],
    ['--success-text', '--background', 4.5],
    ['--warning-text', '--background', 4.5],
    ['--danger-text', '--background', 4.5],
    ['--info-text', '--background', 4.5],
    ['--success-text', '--success-soft', 4.5],
    ['--warning-text', '--warning-soft', 4.5],
    ['--danger-text', '--danger-soft', 4.5],
    ['--info-text', '--info-soft', 4.5],
    ['--border-strong', '--background', 3],
    ['--border-strong', '--surface-1', 3],
    ['--signal-edge', '--background', 3],
    ['--ring', '--background', 3],
    ['--ring', '--surface-1', 3],
    ['--on-media', '--black', 4.5],
    ['--on-media', '--media', 7],
    ['--code-fg', '--code-bg', 7],
    ['--code-muted', '--code-bg', 4.5],
    ['--code-key', '--code-bg', 4.5],
    ['--code-string', '--code-bg', 4.5],
    ['--code-number', '--code-bg', 4.5],
    ['--code-keyword', '--code-bg', 4.5],
];

const THEMES: Theme[] = ['light', 'dark'];

function color(tokens: Map<string, string>, name: string) {
    const value = tokens.get(name);
    const parsed = value ? parseOklch(value) : null;

    if (!parsed) {
        throw new Error(`${name} no es un color oklch: ${value}`);
    }

    return parsed;
}

describe('conversor OKLCH', () => {
    test('el blanco y el negro dan las luminancias de los extremos', () => {
        expect(relativeLuminance(parseOklch('oklch(1 0 0)')!)).toBeCloseTo(1, 3);
        expect(relativeLuminance(parseOklch('oklch(0 0 0)')!)).toBeCloseTo(0, 3);
    });

    test('blanco sobre negro da 21:1', () => {
        expect(
            contrastRatio(parseOklch('oklch(1 0 0)')!, parseOklch('oklch(0 0 0)')!),
        ).toBeCloseTo(21, 1);
    });

    test('lee la transparencia', () => {
        expect(parseOklch('oklch(0.5 0.1 200 / 0.4)')?.alpha).toBe(0.4);
        expect(parseOklch('oklch(0.5 0.1 200 / 40%)')?.alpha).toBe(0.4);
    });
});

describe.each(THEMES)('tokens de color, tema %s', (theme) => {
    const tokens = readThemeTokens(theme);

    test.each(PAIRS)('%s sobre %s llega a %d:1', (foreground, background, minimum) => {
        const ratio = contrastRatio(color(tokens, foreground), color(tokens, background));

        expect(ratio).toBeGreaterThanOrEqual(minimum);
    });

    test('todos los colores caben en sRGB', () => {
        const outOfGamut = [...tokens]
            .map(([name, value]) => [name, parseOklch(value)] as const)
            .filter(([, parsed]) => parsed && !inSrgbGamut(parsed))
            .map(([name]) => name);

        expect(outOfGamut).toEqual([]);
    });

    test('los colores de la máscara facial son valores simples (los lee el worker)', () => {
        for (const name of ['--face-mesh', '--face-mesh-outline', '--face-mesh-feature']) {
            expect(parseOklch(tokens.get(name) ?? '')).not.toBeNull();
        }
    });
});

describe('fondo antes de cargar el CSS', () => {
    const blade = readFileSync(
        join(import.meta.dir, '../../../resources/views/app.blade.php'),
        'utf8',
    );

    test.each([
        ['light', /html\s*\{\s*background-color:\s*([^;]+);/],
        ['dark', /html\.dark\s*\{\s*background-color:\s*([^;]+);/],
    ] as const)('app.blade.php usa el --background del tema %s', (theme, pattern) => {
        const inline = pattern.exec(blade)?.[1]?.trim();

        expect(inline).toBe(readThemeTokens(theme).get('--background'));
    });
});
