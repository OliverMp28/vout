/**
 * Color OKLCH → sRGB y contraste WCAG, sin dependencias. Lo usan los tests
 * del diseño para comprobar los tokens de app.css.
 *
 * Matrices de Björn Ottosson (OKLab) y fórmula de luminancia relativa de
 * WCAG 2.x sobre sRGB lineal.
 */

export type Oklch = { l: number; c: number; h: number; alpha: number };

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)$/;

/** Lee `oklch(L C H)` u `oklch(L C H / A)`. Null si no tiene esa forma. */
export function parseOklch(value: string): Oklch | null {
    const match = OKLCH.exec(value.trim());

    if (!match) {
        return null;
    }

    const alpha = match[4];

    return {
        l: Number(match[1]),
        c: Number(match[2]),
        h: Number(match[3]),
        alpha:
            alpha === undefined
                ? 1
                : alpha.endsWith('%')
                  ? Number(alpha.slice(0, -1)) / 100
                  : Number(alpha),
    };
}

/** sRGB lineal sin recortar: un canal fuera de [0, 1] está fuera de gama. */
export function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);

    const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

    return [
        4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
        -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
        -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
    ];
}

/**
 * Si el color cabe en sRGB, con una tolerancia pequeña (el navegador recorta
 * los desbordes mínimos sin que se note).
 */
export function inSrgbGamut(color: Oklch, tolerance = 0.02): boolean {
    return oklchToLinearSrgb(color).every(
        (channel) => channel >= -tolerance && channel <= 1 + tolerance,
    );
}

/** Luminancia relativa WCAG (0 negro, 1 blanco). */
export function relativeLuminance(color: Oklch): number {
    const [r, g, b] = oklchToLinearSrgb(color).map((channel) =>
        Math.min(1, Math.max(0, channel)),
    );

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores opacos (de 1 a 21). */
export function contrastRatio(a: Oklch, b: Oklch): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);

    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
