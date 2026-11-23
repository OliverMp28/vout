import { describe, expect, test } from 'bun:test';

import { toAbsoluteUrl } from '@/lib/mediapipe/asset-url';
import { describeDiagnostics } from '@/lib/mediapipe/diagnostics';
import { captureSize } from '@/lib/mediapipe/frame-capture';
import { previewCanvasSize } from '@/lib/mediapipe/preview-surface';

describe('toAbsoluteUrl', () => {
    test('resuelve rutas relativas a la página', () => {
        expect(
            toAbsoluteUrl('/build/assets/a.wasm', 'https://vout.cloud/play/x'),
        ).toBe('https://vout.cloud/build/assets/a.wasm');
    });

    test('deja intactas las URLs absolutas (dev server de Vite)', () => {
        expect(
            toAbsoluteUrl(
                'http://localhost:5173/node_modules/x.js',
                'http://localhost/play/x',
            ),
        ).toBe('http://localhost:5173/node_modules/x.js');
    });
});

describe('captureSize', () => {
    test('320 px de ancho respetando la proporción de la cámara', () => {
        expect(captureSize(640, 480)).toEqual({ width: 320, height: 240 });
        expect(captureSize(1280, 720)).toEqual({ width: 320, height: 180 });
    });

    test('sin dimensiones conocidas usa 4:3', () => {
        expect(captureSize(0, 0)).toEqual({ width: 320, height: 240 });
    });
});

describe('describeDiagnostics', () => {
    test('resume el runtime y los fotogramas', () => {
        expect(
            describeDiagnostics({
                info: {
                    mediapipeVersion: '0.10.35',
                    delegate: 'CPU',
                    simd: true,
                    renderer: null,
                    startup: {
                        bundleMs: 12.4,
                        landmarkerMs: 480.6,
                        warmupMs: 95,
                    },
                },
                runtime: 'warm',
                frameSource: 'polling',
                frames: { sent: 10, completed: 9, skipped: 3 },
            }),
        ).toEqual([
            ['mediapipe', '0.10.35'],
            ['delegate', 'CPU'],
            ['simd', 'yes'],
            ['renderer', '—'],
            ['runtime', 'warm'],
            ['startup', '12 · 481 · 95 ms'],
            ['frameSource', 'polling'],
            ['framesSent', '10'],
            ['framesSkipped', '3'],
        ]);
    });

    test('antes de arrancar no inventa datos', () => {
        const rows = describeDiagnostics({
            info: null,
            runtime: null,
            frameSource: 'idle',
            frames: { sent: 0, completed: 0, skipped: 0 },
        });

        expect(rows.slice(0, 6).every(([, value]) => value === '—')).toBe(true);
    });
});

describe('previewCanvasSize', () => {
    test('el lienzo va en píxeles del dispositivo', () => {
        expect(previewCanvasSize(300, 225, 2)).toEqual({
            width: 600,
            height: 450,
            pixelRatio: 2,
        });
    });

    test('en pantallas grandes se limita el lado mayor (y el grosor se ajusta)', () => {
        expect(previewCanvasSize(1600, 900, 2, 1280)).toEqual({
            width: 1280,
            height: 720,
            pixelRatio: 0.8,
        });
    });

    test('un contenedor sin tamaño da un lienzo mínimo', () => {
        expect(previewCanvasSize(0, 0, 0)).toEqual({
            width: 1,
            height: 1,
            pixelRatio: 1,
        });
    });
});
