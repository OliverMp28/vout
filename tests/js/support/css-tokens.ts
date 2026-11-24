import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lee los tokens de color de resources/css/app.css: el bloque `:root` (tema
 * claro) y el bloque `.dark` (tema oscuro, que hereda lo que no redefine).
 * Resuelve las referencias `var(--x)` entre tokens.
 */

export const APP_CSS_PATH = join(import.meta.dir, '../../../resources/css/app.css');

export type Theme = 'light' | 'dark';

function blockDeclarations(css: string, selector: string): Map<string, string> {
    const declarations = new Map<string, string>();
    const opener = new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{`, 'gm');
    let match: RegExpExecArray | null;

    while ((match = opener.exec(css)) !== null) {
        const start = match.index + match[0].length;
        const end = css.indexOf('\n}', start);
        const body = css
            .slice(start, end)
            .replace(/\/\*[\s\S]*?\*\//g, '');

        for (const declaration of body.split(';')) {
            const separator = declaration.indexOf(':');

            if (separator === -1) {
                continue;
            }

            const name = declaration.slice(0, separator).trim();

            if (name.startsWith('--')) {
                declarations.set(
                    name,
                    declaration.slice(separator + 1).trim().replace(/\s+/g, ' '),
                );
            }
        }
    }

    return declarations;
}

/** Los tokens de un tema, ya resueltos (sin `var()`). */
export function readThemeTokens(theme: Theme, css = readFileSync(APP_CSS_PATH, 'utf8')): Map<string, string> {
    const tokens = blockDeclarations(css, ':root');

    if (theme === 'dark') {
        for (const [name, value] of blockDeclarations(css, '.dark')) {
            tokens.set(name, value);
        }
    }

    const resolve = (value: string, depth = 0): string =>
        depth > 10
            ? value
            : value.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
                  resolve(tokens.get(name) ?? `var(${name})`, depth + 1),
              );

    return new Map([...tokens].map(([name, value]) => [name, resolve(value)]));
}
