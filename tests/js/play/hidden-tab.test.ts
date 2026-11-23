import { describe, expect, test } from 'bun:test';

import {
    CAMERA_HIDDEN_STOP_MS,
    createHiddenTabPolicy,
} from '@/lib/play/hidden-tab';

import { ManualScheduler } from '../support/manual-scheduler';

function setup() {
    const scheduler = new ManualScheduler();
    let wall = 1_000_000;
    const events: string[] = [];

    const policy = createHiddenTabPolicy({
        scheduler,
        wallClock: () => wall,
        onHide: () => events.push('hide'),
        onLongHidden: () => events.push('long'),
        onReturn: (kind) => events.push(`return:${kind}`),
    });

    return {
        policy,
        events,
        /** Pasa el tiempo con los temporizadores funcionando. */
        advance: (ms: number) => {
            wall += ms;
            scheduler.advance(ms);
        },
        /** Pasa el tiempo con los temporizadores congelados (equipo dormido). */
        sleep: (ms: number) => {
            wall += ms;
        },
    };
}

describe('createHiddenTabPolicy', () => {
    test('al ocultarla se pausa y, si vuelve pronto, sigue', () => {
        const { policy, events, advance } = setup();

        policy.visibilityChanged(true);
        advance(10_000);
        policy.visibilityChanged(false);

        expect(events).toEqual(['hide', 'return:short']);
    });

    test('tras un minuto oculta se apaga la cámara, una sola vez', () => {
        const { policy, events, advance } = setup();

        policy.visibilityChanged(true);
        advance(CAMERA_HIDDEN_STOP_MS);
        advance(60_000);
        policy.visibilityChanged(false);

        expect(events).toEqual(['hide', 'long', 'return:long']);
    });

    test('con el equipo dormido (sin temporizadores) se apaga al volver', () => {
        const { policy, events, sleep } = setup();

        policy.visibilityChanged(true);
        sleep(5 * 60_000);
        policy.visibilityChanged(false);

        expect(events).toEqual(['hide', 'long', 'return:long']);
    });

    test('ignora avisos repetidos y empieza de cero cada vez', () => {
        const { policy, events, advance } = setup();

        policy.visibilityChanged(false);
        policy.visibilityChanged(true);
        policy.visibilityChanged(true);
        advance(CAMERA_HIDDEN_STOP_MS);
        policy.visibilityChanged(false);
        policy.visibilityChanged(true);
        advance(1_000);
        policy.visibilityChanged(false);

        expect(events).toEqual([
            'hide',
            'long',
            'return:long',
            'hide',
            'return:short',
        ]);
    });

    test('al desmontar no queda nada pendiente', () => {
        const { policy, events, advance } = setup();

        policy.visibilityChanged(true);
        policy.dispose();
        advance(CAMERA_HIDDEN_STOP_MS * 2);

        expect(events).toEqual(['hide']);
    });
});
