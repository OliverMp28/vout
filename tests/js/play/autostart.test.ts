import { describe, expect, test } from 'bun:test';

import {
    AUTOSTART_COUNTDOWN_SECONDS,
    decideAutostart,
    startCountdown,
} from '@/lib/play/autostart';
import type { AutostartInput } from '@/lib/play/autostart';

import { ManualScheduler } from '../support/manual-scheduler';

function decide(overrides: Partial<AutostartInput> = {}) {
    return decideAutostart({
        wanted: true,
        permission: 'granted',
        visible: true,
        gameReady: true,
        engineIdle: true,
        dismissed: false,
        attempted: false,
        ...overrides,
    });
}

describe('decideAutostart', () => {
    test('con todo a favor, cuenta atrás (nunca sin avisar)', () => {
        expect(decide()).toBe('countdown');
    });

    test('sin autorizarlo, nada', () => {
        expect(decide({ wanted: false })).toBe('off');
    });

    test('tras "Ahora no" o tras encenderla, no se insiste', () => {
        expect(decide({ dismissed: true })).toBe('off');
        expect(decide({ attempted: true })).toBe('off');
    });

    test('con el motor ya en marcha, nada', () => {
        expect(decide({ engineIdle: false })).toBe('off');
    });

    test('espera al juego, a la pestaña y a saber el permiso', () => {
        expect(decide({ gameReady: false })).toBe('waiting');
        expect(decide({ visible: false })).toBe('waiting');
        expect(decide({ permission: 'pending' })).toBe('waiting');
    });

    test('sin permiso no lanza el diálogo del navegador: lo explica', () => {
        expect(decide({ permission: 'prompt' })).toBe('ask');
        expect(decide({ permission: 'unknown' })).toBe('ask');
    });

    test('con la cámara bloqueada, dice cómo permitirla', () => {
        expect(decide({ permission: 'denied' })).toBe('blocked');
    });
});

describe('startCountdown', () => {
    test('cuenta los segundos y enciende al llegar a cero', () => {
        const scheduler = new ManualScheduler();
        const ticks: number[] = [];
        let done = 0;

        startCountdown({
            seconds: AUTOSTART_COUNTDOWN_SECONDS,
            scheduler,
            onTick: (remaining) => ticks.push(remaining),
            onDone: () => done++,
        });

        expect(ticks).toEqual([3]);
        scheduler.advance(2000);
        expect(ticks).toEqual([3, 2, 1]);
        expect(done).toBe(0);
        scheduler.advance(1000);
        expect(done).toBe(1);
        expect(scheduler.pendingTimers).toBe(0);
    });

    test('"Ahora no" la cancela: no se enciende', () => {
        const scheduler = new ManualScheduler();
        let done = 0;

        const cancel = startCountdown({
            seconds: 3,
            scheduler,
            onTick: () => {},
            onDone: () => done++,
        });

        scheduler.advance(1500);
        cancel();
        scheduler.advance(5000);

        expect(done).toBe(0);
        expect(scheduler.pendingTimers).toBe(0);
    });
});
