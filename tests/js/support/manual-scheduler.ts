import type { Scheduler, TimerHandle } from '@/lib/mediapipe/scheduler';

type Timer = { id: number; at: number; callback: () => void };

/** Reloj que solo avanza cuando el test lo pide. */
export class ManualScheduler implements Scheduler {
    private time = 0;
    private nextId = 1;
    private timers: Timer[] = [];

    now(): number {
        return this.time;
    }

    setTimeout(callback: () => void, ms: number): TimerHandle {
        const timer = { id: this.nextId++, at: this.time + ms, callback };

        this.timers.push(timer);

        return timer.id;
    }

    clearTimeout(handle: TimerHandle): void {
        this.timers = this.timers.filter((timer) => timer.id !== handle);
    }

    /** Avanza el reloj y ejecuta, en orden, los temporizadores que venzan. */
    advance(ms: number): void {
        const target = this.time + ms;

        for (;;) {
            const due = this.timers
                .filter((timer) => timer.at <= target)
                .sort((a, b) => a.at - b.at || a.id - b.id)[0];

            if (due === undefined) {
                break;
            }

            this.timers = this.timers.filter((timer) => timer !== due);
            this.time = due.at;
            due.callback();
        }

        this.time = target;
    }

    get pendingTimers(): number {
        return this.timers.length;
    }
}

/** Espera a que se resuelvan las promesas pendientes (capturas falsas). */
export async function flushPromises(): Promise<void> {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}
