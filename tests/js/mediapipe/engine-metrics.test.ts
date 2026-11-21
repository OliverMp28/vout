import { describe, expect, test } from 'bun:test';

import {
    EngineMetrics,
    LowCameraFpsDetector,
    sameMetrics,
} from '@/lib/mediapipe/engine-metrics';

const LOW_CAMERA = { thresholdFps: 20, recoverFps: 24, sustainMs: 3000 };

function metrics() {
    return new EngineMetrics({ windowMs: 2000, lowCameraFps: LOW_CAMERA });
}

describe('EngineMetrics', () => {
    test('sin datos: 0 fps analizados y cámara desconocida', () => {
        expect(metrics().snapshot(0)).toEqual({
            fps: 0,
            inferenceMs: 0,
            cameraFps: null,
            cameraSlow: false,
        });
    });

    test('mide fps de la cámara, fps analizados e inferencia media', () => {
        const engine = metrics();

        for (let i = 0; i <= 30; i++) {
            engine.recordCameraFrame(i * (1000 / 30));
        }

        for (let i = 0; i <= 15; i++) {
            engine.recordResult(i * (1000 / 15), i % 2 === 0 ? 20 : 30);
        }

        expect(engine.snapshot(1000)).toEqual({
            fps: 15,
            inferenceMs: 25,
            cameraFps: 30,
            cameraSlow: false,
        });
    });

    test('solo cuenta la ventana reciente', () => {
        const engine = metrics();

        for (let i = 0; i <= 10; i++) {
            engine.recordCameraFrame(i * 100);
        }

        expect(engine.snapshot(1000).cameraFps).toBe(10);
        expect(engine.snapshot(5000).cameraFps).toBeNull();
    });

    test('reset lo olvida todo', () => {
        const engine = metrics();

        engine.recordCameraFrame(0);
        engine.recordCameraFrame(33);
        engine.reset();

        expect(engine.snapshot(50).cameraFps).toBeNull();
    });
});

describe('LowCameraFpsDetector', () => {
    test('avisa tras sustainMs seguidos por debajo del umbral', () => {
        const detector = new LowCameraFpsDetector(LOW_CAMERA);

        expect(detector.update(12, 0)).toBe(false);
        expect(detector.update(12, 2999)).toBe(false);
        expect(detector.update(12, 3000)).toBe(true);
    });

    test('un repunte por encima del umbral reinicia la cuenta', () => {
        const detector = new LowCameraFpsDetector(LOW_CAMERA);

        detector.update(12, 0);
        detector.update(25, 2000);

        expect(detector.update(12, 3000)).toBe(false);
        expect(detector.update(12, 6000)).toBe(true);
    });

    test('deja de avisar solo al superar el umbral de recuperación', () => {
        const detector = new LowCameraFpsDetector(LOW_CAMERA);

        detector.update(10, 0);
        detector.update(10, 3000);

        expect(detector.update(22, 3500)).toBe(true);
        expect(detector.update(24, 4000)).toBe(false);
    });

    test('sin dato de la cámara mantiene la decisión', () => {
        const detector = new LowCameraFpsDetector(LOW_CAMERA);

        detector.update(10, 0);
        detector.update(10, 3000);

        expect(detector.update(null, 3500)).toBe(true);
    });
});

describe('sameMetrics', () => {
    test('compara lo que se ve en la interfaz', () => {
        const a = {
            fps: 30,
            inferenceMs: 12,
            cameraFps: 30,
            cameraSlow: false,
        };

        expect(sameMetrics(a, { ...a })).toBe(true);
        expect(sameMetrics(a, { ...a, fps: 29 })).toBe(false);
        expect(sameMetrics(null, null)).toBe(true);
        expect(sameMetrics(a, null)).toBe(false);
    });
});

describe('EngineMetrics con el contador de la pista', () => {
    test('usa el contador de la cámara antes que las imágenes vistas', () => {
        const engine = metrics();

        // La página solo llegó a ver 5 imágenes por segundo (equipo saturado)…
        for (let i = 0; i <= 5; i++) {
            engine.recordCameraFrame(i * 200);
        }

        // …pero la cámara produjo 30 por segundo.
        engine.recordCameraFrameCount(0, 100);
        engine.recordCameraFrameCount(500, 115);
        engine.recordCameraFrameCount(1000, 130);

        expect(engine.snapshot(1000).cameraFps).toBe(30);
    });

    test('si el contador vuelve a empezar (otra cámara) descarta lo anterior', () => {
        const engine = metrics();

        engine.recordCameraFrameCount(0, 900);
        engine.recordCameraFrameCount(500, 3);
        engine.recordCameraFrameCount(1000, 18);

        expect(engine.snapshot(1000).cameraFps).toBe(30);
    });
});
