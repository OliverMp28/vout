import { readFileSync, writeFileSync } from 'node:fs';
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
 * El JSON de partida guarda cuántos había al empezar el rediseño. La cuenta de
 * un archivo solo puede bajar y un archivo nuevo tiene que llegar con cero.
 * Tras limpiar un archivo, actualiza el JSON con:
 *
 *   UPDATE_STYLE_BASELINE=1 vendor/bin/sail bun test tests/js/design/style-guard.test.ts
 */

const ROOT = join(import.meta.dir, '../../..');
const BASELINE_PATH = join(import.meta.dir, 'style-baseline.json');

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

const current = scan();

if (process.env.UPDATE_STYLE_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 4)}\n`);
}

const baseline: Counts = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

describe('estilo: sin volver al diseño anterior', () => {
    test('ningún archivo usa más clases prohibidas que al empezar', () => {
        const regressions: string[] = [];

        for (const [file, rules] of Object.entries(current)) {
            for (const [rule, found] of Object.entries(rules)) {
                const allowed = baseline[file]?.[rule] ?? 0;

                if (found > allowed) {
                    regressions.push(`${file}: ${rule} ${found} (máximo ${allowed})`);
                }
            }
        }

        expect(regressions).toEqual([]);
    });
});
