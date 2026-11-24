/**
 * Portada generada para los juegos sin imagen: un pequeño nivel de bloques
 * (terreno, nubes, plataformas y monedas) sacado del slug, así que cada juego
 * tiene la suya y siempre la misma. Un solo tono por juego: el color lo pone
 * el juego, no la marca, y nunca choca con lo que tenga alrededor.
 *
 * Módulo puro (sin DOM): devuelve los rectángulos y el tono; el componente
 * `GameCover` los pinta con los tokens `--cover-*` del tema.
 */

export const COVER_WIDTH = 16;
export const COVER_HEIGHT = 9;

/** Tonos (OKLCH) posibles. Sin violeta: no es la marca. */
export const COVER_HUES = [205, 350, 75, 150, 25, 235, 120, 55] as const;

export type CoverRect = { x: number; y: number; width: number; height: number };

export type GeneratedCover = {
    hue: number;
    land: CoverRect[];
    edge: CoverRect[];
    clouds: CoverRect[];
    platforms: CoverRect[];
};

/** FNV-1a de 32 bits: el mismo slug da siempre el mismo número. */
export function hashSlug(slug: string): number {
    let hash = 2166136261;

    for (let i = 0; i < slug.length; i++) {
        hash ^= slug.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

/** Generador pseudoaleatorio mulberry32: reproducible a partir de la semilla. */
function seededRandom(seed: number): () => number {
    let state = seed;

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function generateCover(slug: string): GeneratedCover {
    const seed = hashSlug(slug);
    const random = seededRandom(seed);
    const hue = COVER_HUES[seed % COVER_HUES.length];

    let height = 2 + Math.floor(random() * 3);
    const columns: number[] = [];

    for (let x = 0; x < COVER_WIDTH; x++) {
        const step = random();

        if (step < 0.25) {
            height++;
        } else if (step < 0.5) {
            height--;
        }

        height = Math.max(1, Math.min(5, height));
        const isGap = x > 1 && x < COVER_WIDTH - 2 && random() < 0.1;
        columns.push(isGap ? 0 : height);
    }

    const land: CoverRect[] = [];
    const edge: CoverRect[] = [];

    columns.forEach((columnHeight, x) => {
        if (columnHeight === 0) {
            return;
        }

        const top = COVER_HEIGHT - columnHeight;
        // 1.02 de ancho para que no se vean juntas entre columnas.
        land.push({ x, y: top, width: 1.02, height: columnHeight });
        edge.push({ x, y: top, width: 1.02, height: 0.34 });
    });

    const clouds: CoverRect[] = [];
    const cloudCount = 1 + Math.floor(random() * 2);

    for (let i = 0; i < cloudCount; i++) {
        const x = Math.floor(random() * (COVER_WIDTH - 3));
        const y = 1.1 + Math.floor(random() * 2) * 0.8;
        clouds.push({ x, y, width: 3, height: 0.6 });
        clouds.push({ x: x + 0.6, y: y - 0.5, width: 1.6, height: 0.5 });
    }

    const platforms: CoverRect[] = [];
    const platformCount = 1 + Math.floor(random() * 2);

    for (let i = 0; i < platformCount; i++) {
        const x = 1 + Math.floor(random() * (COVER_WIDTH - 4));
        const width = 2 + Math.floor(random() * 2);
        const ground = Math.max(columns[x] ?? 0, columns[x + 1] ?? 0);
        const y = Math.max(2.4, COVER_HEIGHT - ground - 2.4);
        platforms.push({ x, y, width, height: 0.6 });
        // Dos monedas sobre la plataforma.
        platforms.push({ x: x + 0.2, y: y - 1, width: 0.5, height: 0.5 });
        platforms.push({ x: x + 1.2, y: y - 1, width: 0.5, height: 0.5 });
    }

    return { hue, land, edge, clouds, platforms };
}

/** Iniciales para la esquina de la portada ("Salto de Muelle" → "SM"). */
export function coverInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter((word) => word.length > 2 || /^\p{Lu}/u.test(word))
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');
}
