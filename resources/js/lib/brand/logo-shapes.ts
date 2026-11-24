/**
 * Formas del logo de Vout, calcadas de los PNG originales
 * (public/logos/vout-wordmark.png y vout-icon@2x.png) a rectángulos sobre su
 * rejilla de píxeles. Cada rectángulo es [x, y, ancho, alto]. Se regeneran
 * con los scripts de docs/planes/d-muestras (word_clean.py, icon_build.py y
 * logo_ts.py).
 */

export type LogoRect = readonly [number, number, number, number];

/** Ancho y alto de la rejilla del wordmark "Vout". */
export const WORDMARK_SIZE = { width: 712, height: 257 } as const;

/** Ancho y alto de la rejilla del icono "V". */
export const ICON_SIZE = { width: 54, height: 50 } as const;

/** Las cuatro letras de "Vout". */
export const WORDMARK_RECTS: readonly LogoRect[] = [
    [622, 0, 51, 63],
    [252, 63, 92, 29],
    [596, 63, 116, 36],
    [314, 92, 45, 28],
    [238, 92, 46, 28],
    [130, 0, 50, 163],
    [0, 0, 50, 163],
    [331, 120, 49, 74],
    [218, 120, 48, 74],
    [105, 163, 51, 31],
    [26, 163, 51, 31],
    [218, 194, 66, 11],
    [314, 194, 66, 11],
    [416, 63, 51, 163],
    [528, 63, 50, 163],
    [622, 99, 51, 127],
    [50, 194, 80, 32],
    [314, 205, 45, 21],
    [238, 205, 46, 21],
    [436, 226, 142, 31],
    [252, 226, 92, 31],
    [642, 226, 70, 31],
    [77, 226, 28, 31],
];

/** La V del icono. */
export const ICON_V_RECTS: readonly LogoRect[] = [
    [39, 5, 10, 4],
    [5, 5, 10, 4],
    [37, 9, 12, 2],
    [5, 9, 12, 2],
    [7, 11, 10, 2],
    [37, 11, 10, 2],
    [7, 13, 12, 2],
    [35, 13, 12, 2],
    [9, 15, 12, 4],
    [33, 15, 12, 4],
    [31, 19, 14, 2],
    [9, 19, 14, 2],
    [31, 21, 12, 2],
    [11, 21, 12, 2],
    [31, 23, 10, 4],
    [13, 23, 10, 4],
    [29, 27, 12, 2],
    [13, 27, 12, 2],
    [29, 29, 10, 4],
    [15, 29, 10, 4],
    [15, 33, 24, 2],
    [17, 35, 20, 4],
    [19, 39, 16, 2],
    [21, 41, 12, 4],
];

/** El contorno escalonado que rodea la V, separado por un hueco. */
export const ICON_RING_RECTS: readonly LogoRect[] = [
    [0, 0, 20, 2],
    [34, 0, 20, 2],
    [34, 2, 2, 2],
    [18, 2, 2, 2],
    [18, 4, 4, 2],
    [32, 4, 4, 2],
    [32, 6, 2, 2],
    [20, 6, 2, 2],
    [20, 8, 4, 2],
    [30, 8, 4, 2],
    [22, 10, 4, 2],
    [28, 10, 4, 2],
    [52, 2, 2, 12],
    [0, 2, 2, 12],
    [24, 12, 2, 2],
    [28, 12, 2, 2],
    [0, 14, 4, 2],
    [50, 14, 4, 2],
    [24, 14, 6, 2],
    [2, 16, 2, 2],
    [50, 16, 2, 2],
    [2, 18, 4, 2],
    [48, 18, 4, 2],
    [26, 16, 2, 8],
    [4, 20, 2, 4],
    [48, 20, 2, 4],
    [46, 24, 4, 2],
    [4, 24, 4, 2],
    [44, 26, 4, 2],
    [6, 26, 4, 2],
    [8, 28, 2, 4],
    [44, 28, 2, 4],
    [42, 32, 4, 2],
    [8, 32, 4, 2],
    [10, 34, 2, 4],
    [42, 34, 2, 4],
    [40, 38, 4, 2],
    [10, 38, 4, 2],
    [12, 40, 2, 2],
    [40, 40, 2, 2],
    [38, 42, 4, 2],
    [12, 42, 4, 2],
    [36, 44, 4, 2],
    [14, 44, 4, 2],
    [36, 46, 2, 2],
    [16, 46, 2, 2],
    [16, 48, 22, 2],
];
