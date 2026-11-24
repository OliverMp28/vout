import { describe, expect, test } from 'bun:test';

import {
    COVER_HEIGHT,
    COVER_HUES,
    COVER_WIDTH,
    coverInitials,
    generateCover,
    hashSlug,
} from '@/lib/brand/generated-cover';

describe('portada generada', () => {
    test('el mismo slug da siempre la misma portada', () => {
        expect(generateCover('salto-de-muelle')).toEqual(
            generateCover('salto-de-muelle'),
        );
    });

    test('slugs distintos dan portadas distintas', () => {
        const slugs = ['salto-de-muelle', 'cuarto-oscuro', 'torre-de-cajas', 'eco', 'daino'];
        const covers = new Set(slugs.map((slug) => JSON.stringify(generateCover(slug))));

        expect(covers.size).toBe(slugs.length);
    });

    test('usa uno de los tonos permitidos, nunca violeta', () => {
        for (const slug of ['a', 'b', 'globo-y-puas', 'pesca-nocturna']) {
            const { hue } = generateCover(slug);

            expect(COVER_HUES).toContain(hue as (typeof COVER_HUES)[number]);
            expect(hue >= 270 && hue <= 320).toBe(false);
        }
    });

    test('todo queda dentro del lienzo y hay terreno', () => {
        for (let i = 0; i < 50; i++) {
            const cover = generateCover(`juego-${i}`);
            const rects = [...cover.land, ...cover.edge, ...cover.clouds, ...cover.platforms];

            expect(cover.land.length).toBeGreaterThan(0);

            for (const rect of rects) {
                expect(rect.x).toBeGreaterThanOrEqual(0);
                expect(rect.y).toBeGreaterThanOrEqual(0);
                expect(rect.x + rect.width).toBeLessThanOrEqual(COVER_WIDTH + 0.05);
                expect(rect.y + rect.height).toBeLessThanOrEqual(COVER_HEIGHT);
            }
        }
    });

    test('el hash es estable entre ejecuciones', () => {
        expect(hashSlug('daino')).toBe(hashSlug('daino'));
        expect(hashSlug('daino')).not.toBe(hashSlug('daino2'));
    });
});

describe('iniciales de la portada', () => {
    test.each([
        ['Salto de Muelle', 'SM'],
        ['Eco', 'E'],
        ['Tres en Raya Rápido', 'TR'],
        ['Ñu Saltarín', 'ÑS'],
        ['daino', 'D'],
    ])('%s → %s', (name, initials) => {
        expect(coverInitials(name)).toBe(initials);
    });
});
