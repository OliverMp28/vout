import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'bun:test';

/**
 * Vigila que no vuelva el estilo anterior (el que hacía parecer el portal
 * hecho con IA) ni los colores puestos a mano.
 *
 * Cuenta, por archivo de resources/js, los usos de:
 * - clases de la paleta de Tailwind (`bg-emerald-500`, `text-violet-400`…)
 *   y `white`/`black` en vez de los tokens con significado;
 * - cristal, halos y flotaciones (`backdrop-blur`, `blur-3xl`, `glass-card`,
 *   `animate-float`, `animate-glow-pulse`), degradados (`bg-linear-to`,
 *   `radial-gradient`, `--vout-gradient`) y `transition-all`.
 *
 * Al empezar el rediseño había cientos; ahora no queda ninguno y ningún
 * archivo nuevo puede traerlos. Para un color fijo justificado (una marca
 * ajena), añade el archivo a `ALLOWED` con el motivo.
 */

const ROOT = join(import.meta.dir, '../../..');

const PALETTE =
    'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PREFIX =
    'bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|shadow|divide|accent|caret|placeholder';

const RULES: Record<string, RegExp> = {
    palette: new RegExp(`\\b(?:${PREFIX})-(?:${PALETTE})-\\d{2,3}\\b`, 'g'),
    'white/black': new RegExp(`\\b(?:${PREFIX})-(?:white|black)\\b`, 'g'),
    blur: /\b(?:backdrop-blur(?:-\w+)?|blur-(?:2xl|3xl))\b/g,
    glass: /\bglass-card(?:-light)?\b/g,
    float: /\banimate-(?:float(?:-slow)?|glow-pulse)\b/g,
    gradient: /\bbg-linear-to-\w+|radial-gradient|--vout-gradient/g,
    'transition-all': /\btransition-all\b/g,
};

/** Archivos que pueden usar colores fijos con motivo. */
const ALLOWED = new Set([
    // Los colores de la marca de Google en su botón de acceso.
    'resources/js/components/icons/google-icon.tsx',
]);

type Counts = Record<string, Record<string, number>>;

function scan(): Counts {
    const glob = new Bun.Glob('resources/js/**/*.{ts,tsx}');
    const counts: Counts = {};

    for (const path of glob.scanSync({ cwd: ROOT })) {
        const file = relative(ROOT, join(ROOT, path));

        if (ALLOWED.has(file)) {
            continue;
        }

        const source = readFileSync(join(ROOT, path), 'utf8');

        for (const [rule, pattern] of Object.entries(RULES)) {
            const found = source.match(pattern)?.length ?? 0;

            if (found > 0) {
                counts[file] ??= {};
                counts[file][rule] = found;
            }
        }
    }

    return Object.fromEntries(
        Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    );
}

describe('estilo: sin volver al diseño anterior', () => {
    test('ningún archivo usa clases de paleta, cristal, halos ni transition-all', () => {
        const found = Object.entries(scan()).flatMap(([file, rules]) =>
            Object.entries(rules).map(
                ([rule, count]) => `${file}: ${rule} ×${count}`,
            ),
        );

        expect(found).toEqual([]);
    });

    test('la paleta por defecto de Tailwind está bloqueada en app.css', () => {
        const css = readFileSync(join(ROOT, 'resources/css/app.css'), 'utf8');

        expect(css).toMatch(/@theme\s*\{\s*--color-\*:\s*initial;/);
    });
});
