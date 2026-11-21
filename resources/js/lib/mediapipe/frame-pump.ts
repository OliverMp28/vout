/**
 * Control de flujo de los fotogramas hacia el worker de detección.
 *
 * Reglas:
 *
 *   1. Como mucho **un fotograma en vuelo**. No se envía otro hasta que el
 *      worker responde al anterior (`complete`). Así nunca se forma cola en el
 *      worker y nunca se analiza una imagen vieja.
 *   2. Solo se envían **imágenes nuevas** de la cámara (`notifyFrame`). Mandar
 *      dos veces la misma es trabajo perdido para la GPU.
 *   3. Si llegan imágenes mientras el worker trabaja, no se guardan: al
 *      responder se captura la **más reciente** en ese momento.
 *   4. Si el worker no responde en `responseTimeoutMs`, se avisa
 *      (`onResponseTimeout`) pero **no** se envía otro: el protocolo garantiza
 *      una respuesta por fotograma, así que un worker que tarda está ocupado,
 *      no ha perdido el mensaje. Mandarle más solo crearía la cola que esta
 *      clase evita (pasa en equipos lentos con el primer fotograma, que
 *      compila los shaders).
 *
 * El ritmo resultante es el menor entre los fps de la cámara y lo que tarde
 * la inferencia, sin cola.
 *
 * La captura y el envío se inyectan (en el navegador, `createImageBitmap` y
 * `worker.postMessage`), así que el módulo no depende del DOM y se prueba con
 * fakes.
 */

import type { Scheduler, TimerHandle } from './scheduler';

/** Aviso de que la cámara tiene una imagen nueva. */
export type FrameStamp = {
    /** Crece con cada imagen nueva. */
    key: number;
    /**
     * Momento en que la cámara tomó la imagen, en la línea de tiempo de
     * `performance.now()`, o null si el navegador no lo da.
     */
    captureTime: number | null;
};

/** Un fotograma enviado al worker cuya respuesta aún no ha llegado. */
export type InFlightFrame = {
    frameId: number;
    /** Aviso de la cámara que se estaba atendiendo al capturar. */
    stamp: FrameStamp;
    /** Cuándo empezó la captura (y marca del fotograma para MediaPipe). */
    captureStartedAt: number;
    /** Cuándo se entregó al worker. */
    sentAt: number;
};

export type FramePumpStats = {
    sent: number;
    completed: number;
    /** Imágenes de la cámara que no se analizaron por estar el worker ocupado. */
    skipped: number;
};

export type FramePumpOptions<TFrame> = {
    /** Captura la imagen actual de la cámara. `null` si aún no hay imagen. */
    capture: () => Promise<TFrame | null>;
    /** Entrega el fotograma al worker. */
    send: (frameId: number, frame: TFrame, timestamp: number) => void;
    /** Libera un fotograma capturado que ya no se va a enviar. */
    discard: (frame: TFrame) => void;
    scheduler: Scheduler;
    responseTimeoutMs: number;
    /** El worker lleva `responseTimeoutMs` sin responder al fotograma. */
    onResponseTimeout?: (frame: InFlightFrame) => void;
};

export class FramePump<TFrame> {
    private readonly options: FramePumpOptions<TFrame>;

    private running = false;
    /** `key` de la imagen que se está capturando, o null. */
    private capturingKey: number | null = null;
    /** Se incrementa al parar o reanudar: invalida capturas en curso. */
    private generation = 0;

    private inFlight: InFlightFrame | null = null;
    private responseTimer: TimerHandle | null = null;

    private latestStamp: FrameStamp | null = null;
    private lastSentKey: number | null = null;
    private nextFrameId = 1;
    private lastTimestamp = -Infinity;

    private counters: FramePumpStats = {
        sent: 0,
        completed: 0,
        skipped: 0,
    };

    constructor(options: FramePumpOptions<TFrame>) {
        this.options = options;
    }

    /** Empieza (o reanuda) a enviar fotogramas. */
    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.generation++;
        this.pump();
    }

    /**
     * Deja de enviar. El fotograma en vuelo, si lo hay, puede seguir
     * completándose: su respuesta no se pierde.
     */
    pause(): void {
        this.running = false;
        this.generation++;
    }

    /** Para y olvida todo el estado. */
    stop(): void {
        this.pause();
        this.clearResponseTimer();
        this.inFlight = null;
        this.latestStamp = null;
        this.lastSentKey = null;
    }

    /** La cámara tiene una imagen nueva. */
    notifyFrame(stamp: FrameStamp): void {
        const previous = this.latestStamp;

        if (
            previous !== null &&
            previous.key !== this.lastSentKey &&
            previous.key !== this.capturingKey
        ) {
            this.counters.skipped++;
        }

        this.latestStamp = stamp;
        this.pump();
    }

    /**
     * El worker respondió al fotograma `frameId` (con resultado o sin él).
     *
     * @returns El fotograma en vuelo que se completa, o null si la respuesta
     *          no corresponde a él (llega tras un `stop`).
     */
    complete(frameId: number): InFlightFrame | null {
        if (this.inFlight === null || this.inFlight.frameId !== frameId) {
            return null;
        }

        const completed = this.inFlight;

        this.clearResponseTimer();
        this.inFlight = null;
        this.counters.completed++;
        this.pump();

        return completed;
    }

    get isRunning(): boolean {
        return this.running;
    }

    get hasFrameInFlight(): boolean {
        return this.inFlight !== null;
    }

    get stats(): FramePumpStats {
        return { ...this.counters };
    }

    private pump(): void {
        if (
            !this.running ||
            this.capturingKey !== null ||
            this.inFlight !== null ||
            this.latestStamp === null ||
            this.latestStamp.key === this.lastSentKey
        ) {
            return;
        }

        const stamp = this.latestStamp;
        const generation = this.generation;
        const captureStartedAt = this.options.scheduler.now();

        this.capturingKey = stamp.key;

        this.options.capture().then(
            (frame) => {
                this.capturingKey = null;

                if (frame === null) {
                    return;
                }

                if (generation !== this.generation || !this.running) {
                    this.options.discard(frame);
                    this.pump();

                    return;
                }

                this.dispatch(frame, stamp, captureStartedAt);
            },
            () => {
                // Una captura puede fallar puntualmente (el vídeo cambió de
                // tamaño, la pista se reinició). Se reintenta con la próxima
                // imagen de la cámara.
                this.capturingKey = null;
            },
        );
    }

    private dispatch(
        frame: TFrame,
        stamp: FrameStamp,
        captureStartedAt: number,
    ): void {
        // MediaPipe exige marcas estrictamente crecientes en modo VIDEO.
        const timestamp = Math.max(captureStartedAt, this.lastTimestamp + 0.01);
        const frameId = this.nextFrameId++;

        this.lastTimestamp = timestamp;
        this.lastSentKey = stamp.key;
        this.inFlight = {
            frameId,
            stamp,
            captureStartedAt: timestamp,
            sentAt: this.options.scheduler.now(),
        };
        this.counters.sent++;

        this.options.send(frameId, frame, timestamp);
        this.armResponseTimer(frameId);
    }

    private armResponseTimer(frameId: number): void {
        this.clearResponseTimer();
        this.responseTimer = this.options.scheduler.setTimeout(() => {
            this.responseTimer = null;

            if (this.inFlight?.frameId === frameId) {
                this.options.onResponseTimeout?.(this.inFlight);
            }
        }, this.options.responseTimeoutMs);
    }

    private clearResponseTimer(): void {
        if (this.responseTimer !== null) {
            this.options.scheduler.clearTimeout(this.responseTimer);
            this.responseTimer = null;
        }
    }
}
