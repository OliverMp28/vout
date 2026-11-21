import { describe, expect, test } from 'bun:test';

import { TelemetryCollector } from '@/lib/mediapipe/telemetry';

describe('TelemetryCollector', () => {
    test('sin muestras devuelve un snapshot vacío', () => {
        expect(new TelemetryCollector().snapshot()).toEqual({});
    });

    test('calcula percentiles, media, mínimo y máximo', () => {
        const telemetry = new TelemetryCollector();

        for (let value = 1; value <= 100; value++) {
            telemetry.push('inferenceMs', value);
        }

        const stats = telemetry.snapshot().inferenceMs;

        expect(stats.count).toBe(100);
        expect(stats.min).toBe(1);
        expect(stats.max).toBe(100);
        expect(stats.avg).toBeCloseTo(50.5);
        expect(stats.p50).toBe(51);
        expect(stats.p95).toBe(96);
    });

    test('es un buffer circular: solo cuenta las últimas `capacity` muestras', () => {
        const telemetry = new TelemetryCollector(3);

        [100, 100, 100, 1, 2, 3].forEach((value) =>
            telemetry.push('queueMs', value),
        );

        const stats = telemetry.snapshot().queueMs;

        expect(stats.count).toBe(3);
        expect(stats.max).toBe(3);
    });

    test('reset vacía todas las métricas', () => {
        const telemetry = new TelemetryCollector();

        telemetry.push('a', 1);
        telemetry.reset();

        expect(telemetry.snapshot()).toEqual({});
    });

    test('export genera CSV ordenado por métrica', () => {
        const telemetry = new TelemetryCollector();

        telemetry.push('b', 2);
        telemetry.push('a', 1);

        const lines = telemetry.export().trim().split('\n');

        expect(lines[0]).toBe('Metric,p50,p95,avg,min,max,count');
        expect(lines[1].startsWith('a,')).toBe(true);
        expect(lines[2].startsWith('b,')).toBe(true);
    });

    test('export añade al final la tabla de contexto', () => {
        const telemetry = new TelemetryCollector();

        telemetry.push('a', 1);

        const csv = telemetry.export([
            ['mediapipe', '0.10.35'],
            ['renderer', 'ANGLE (Intel "UHD")'],
        ]);

        expect(
            csv.endsWith(
                '\nInfo,Value\nmediapipe,"0.10.35"\nrenderer,"ANGLE (Intel ""UHD"")"\n',
            ),
        ).toBe(true);
    });
});
