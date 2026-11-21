import { describe, expect, test } from 'bun:test';

import { toAbsoluteUrl } from '@/lib/mediapipe/asset-url';
import { describeDiagnostics } from '@/lib/mediapipe/diagnostics';
import { captureSize } from '@/lib/mediapipe/frame-capture';

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
                },
                frameSource: 'polling',
                frames: { sent: 10, completed: 9, skipped: 3 },
            }),
        ).toEqual([
            ['mediapipe', '0.10.35'],
            ['delegate', 'CPU'],
            ['simd', 'yes'],
            ['renderer', '—'],
            ['frameSource', 'polling'],
            ['framesSent', '10'],
            ['framesSkipped', '3'],
        ]);
    });

    test('antes de arrancar no inventa datos', () => {
        const rows = describeDiagnostics({
            info: null,
            frameSource: 'idle',
            frames: { sent: 0, completed: 0, skipped: 0 },
        });

        expect(rows.slice(0, 4).every(([, value]) => value === '—')).toBe(true);
    });
});
