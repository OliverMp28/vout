import { describe, expect, test } from 'bun:test';

import {
    MESH_LAYERS,
    coverFit,
    drawFaceMesh,
    uniqueConnections,
} from '@/lib/mediapipe/face-mesh-drawing';
import type { MeshConnections } from '@/lib/mediapipe/face-mesh-drawing';
import { PreviewRenderer } from '@/lib/mediapipe/preview-renderer';
import type { PreviewOptions } from '@/lib/mediapipe/types';

import { FakeCanvas, FakeContext } from '../support/fake-canvas';

const POINTS = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
];

const CONNECTIONS: MeshConnections = {
    tesselation: [
        { start: 0, end: 1 },
        { start: 1, end: 2 },
        { start: 2, end: 3 },
    ],
    outline: [{ start: 0, end: 2 }],
    features: [{ start: 1, end: 3 }],
};

const COLORS = { mesh: 'gray', outline: 'white', feature: 'violet' };
const FULL_CANVAS = { x: 0, y: 0, width: 100, height: 100 };

describe('coverFit', () => {
    test('una imagen 4:3 en un hueco 16:9 se recorta por arriba y por abajo', () => {
        expect(coverFit(320, 240, 1600, 900)).toEqual({
            x: 0,
            y: -150,
            width: 1600,
            height: 1200,
        });
    });

    test('en un hueco más alto se recorta por los lados', () => {
        const fit = coverFit(320, 240, 300, 400);

        expect(fit.width).toBeCloseTo(533.33, 2);
        expect(fit.height).toBe(400);
        expect(fit.x).toBeCloseTo(-116.67, 2);
        expect(fit.y).toBe(0);
    });

    test('con la misma proporción ocupa el lienzo entero', () => {
        expect(coverFit(320, 240, 640, 480)).toEqual({
            x: 0,
            y: 0,
            width: 640,
            height: 480,
        });
    });

    test('sin tamaño de imagen, el lienzo entero', () => {
        expect(coverFit(0, 0, 10, 20)).toEqual({
            x: 0,
            y: 0,
            width: 10,
            height: 20,
        });
    });
});

describe('uniqueConnections', () => {
    test('cada arista una vez, aunque venga en los dos sentidos', () => {
        expect(
            uniqueConnections([
                { start: 0, end: 1 },
                { start: 1, end: 0 },
                { start: 1, end: 2 },
                { start: 0, end: 1 },
                { start: 477, end: 3 },
            ]),
        ).toEqual([
            { start: 0, end: 1 },
            { start: 1, end: 2 },
            { start: 3, end: 477 },
        ]);
    });
});

describe('drawFaceMesh', () => {
    test('cada nivel dibuja sus capas', () => {
        expect(MESH_LAYERS.off).toEqual([]);
        expect(MESH_LAYERS.contours).toEqual(['outline', 'features']);
        expect(MESH_LAYERS.full).toEqual([
            'tesselation',
            'outline',
            'features',
        ]);
    });

    test('un solo trazo por capa, con todas sus líneas', () => {
        const context = new FakeContext();

        drawFaceMesh(context, POINTS, CONNECTIONS, 'full', FULL_CANVAS, {
            colors: COLORS,
            pixelRatio: 2,
        });

        // Malla tenue debajo; perfil y rasgos, cada uno con su color, encima.
        expect(context.strokes).toEqual([
            { color: 'gray', width: 1.2, segments: 3 },
            { color: 'white', width: 2.5, segments: 1 },
            { color: 'violet', width: 2.5, segments: 1 },
        ]);
    });

    test('los contornos no dibujan la malla', () => {
        const context = new FakeContext();

        drawFaceMesh(context, POINTS, CONNECTIONS, 'contours', FULL_CANVAS, {
            colors: COLORS,
            pixelRatio: 1,
        });

        expect(context.strokes.map((stroke) => stroke.segments)).toEqual([
            1, 1,
        ]);
    });

    test('los puntos se colocan sobre la imagen encuadrada', () => {
        const context = new FakeContext();

        drawFaceMesh(
            context,
            POINTS,
            { tesselation: [], outline: [{ start: 0, end: 2 }], features: [] },
            'contours',
            { x: 10, y: -20, width: 200, height: 100 },
            { colors: COLORS, pixelRatio: 1 },
        );

        expect(
            context.calls.filter(
                (call) => call[0] !== 'beginPath' && call[0] !== 'stroke',
            ),
        ).toEqual([
            ['moveTo', 10, -20],
            ['lineTo', 210, 80],
        ]);
    });

    test('se salta conexiones con puntos que no existen', () => {
        const context = new FakeContext();

        drawFaceMesh(
            context,
            POINTS,
            { tesselation: [], outline: [{ start: 0, end: 99 }], features: [] },
            'contours',
            FULL_CANVAS,
            { colors: COLORS, pixelRatio: 1 },
        );

        expect(context.strokes).toEqual([
            { color: 'white', width: 1.25, segments: 0 },
        ]);
    });
});

describe('PreviewRenderer', () => {
    const SYNCED: PreviewOptions = {
        mode: 'synced',
        mesh: 'contours',
        colors: COLORS,
    };
    const OVERLAY: PreviewOptions = { ...SYNCED, mode: 'overlay' };
    const SIZE = { width: 640, height: 480, pixelRatio: 2 };
    const IMAGE = {} as CanvasImageSource;

    function renderer(now: () => number = () => 0) {
        const instance = new PreviewRenderer(now);

        instance.setConnections(CONNECTIONS);

        return instance;
    }

    function frame(landmarks: typeof POINTS | null = POINTS) {
        return { image: IMAGE, width: 320, height: 240, landmarks };
    }

    test('sin lienzo no dibuja nada', () => {
        expect(renderer().render(frame())).toBeNull();
    });

    test('al ceder el lienzo le da el tamaño pedido', () => {
        const canvas = new FakeCanvas();

        renderer().attach(canvas, SIZE, SYNCED);

        expect([canvas.width, canvas.height]).toEqual([640, 480]);
    });

    test('sincronizada: pinta la imagen encuadrada y su malla encima', () => {
        const canvas = new FakeCanvas();
        const instance = renderer();

        instance.attach(canvas, SIZE, SYNCED);
        instance.render(frame());

        expect(canvas.context.calls[0]).toEqual([
            'drawImage',
            IMAGE,
            0,
            0,
            640,
            480,
        ]);
        expect(canvas.context.strokes).toHaveLength(2);
    });

    test('superpuesta: borra y dibuja solo la malla', () => {
        const canvas = new FakeCanvas();
        const instance = renderer();

        instance.attach(canvas, SIZE, OVERLAY);
        canvas.context.calls = [];
        instance.render(frame());

        expect(canvas.context.calls[0]).toEqual(['clearRect', 0, 0, 640, 480]);
        expect(
            canvas.context.calls.some((call) => call[0] === 'drawImage'),
        ).toBe(false);
        expect(canvas.context.strokes).toHaveLength(2);
    });

    test('sin cara, la imagen sola (o nada superpuesto)', () => {
        const synced = new FakeCanvas();
        const overlay = new FakeCanvas();

        const first = renderer();
        first.attach(synced, SIZE, SYNCED);
        first.render(frame(null));

        const second = renderer();
        second.attach(overlay, SIZE, OVERLAY);
        second.render(frame(null));

        expect(synced.context.strokes).toEqual([]);
        expect(synced.context.calls[0][0]).toBe('drawImage');
        expect(overlay.context.strokes).toEqual([]);
    });

    test('con la malla apagada solo va la imagen', () => {
        const canvas = new FakeCanvas();
        const instance = renderer();

        instance.attach(canvas, SIZE, { ...SYNCED, mesh: 'off' });
        instance.render(frame());

        expect(canvas.context.strokes).toEqual([]);
    });

    test('las opciones nuevas se aplican al siguiente fotograma', () => {
        const canvas = new FakeCanvas();
        const instance = renderer();

        instance.attach(canvas, SIZE, SYNCED);
        instance.setOptions({ ...SYNCED, mesh: 'full' });
        instance.render(frame());

        expect(canvas.context.strokes).toHaveLength(3);
    });

    test('el grosor sigue la densidad de píxeles', () => {
        const canvas = new FakeCanvas();
        const instance = renderer();

        instance.attach(canvas, SIZE, SYNCED);
        instance.resize({ width: 300, height: 200, pixelRatio: 1 });
        instance.render(frame());

        expect([canvas.width, canvas.height]).toEqual([300, 200]);
        expect(canvas.context.strokes[0].width).toBe(1.25);
    });

    test('devuelve lo que tardó en dibujar', () => {
        const canvas = new FakeCanvas();
        let time = 10;
        const instance = renderer(() => {
            time += 2;

            return time;
        });

        instance.attach(canvas, SIZE, SYNCED);

        expect(instance.render(frame())).toBe(2);
    });

    test('al soltar el lienzo lo deja transparente', () => {
        const canvas = new FakeCanvas();
        const instance = renderer();

        instance.attach(canvas, SIZE, SYNCED);
        instance.detach();

        expect(canvas.context.calls.at(-1)).toEqual([
            'clearRect',
            0,
            0,
            640,
            480,
        ]);
        expect(instance.isAttached).toBe(false);
        expect(instance.render(frame())).toBeNull();
    });

    test('un lienzo sin contexto 2D no se usa', () => {
        const instance = renderer();

        instance.attach(new FakeCanvas(null), SIZE, SYNCED);

        expect(instance.isAttached).toBe(false);
    });
});
