/**
 * Avisa de cada imagen nueva que entrega la cámara a un `<video>`.
 *
 * Dos modos:
 *
 *   - `video-frame-callback`: `requestVideoFrameCallback`. Avisa una vez por
 *     imagen y da la hora real de captura (`captureTime`), con la que se mide
 *     la latencia desde la cámara.
 *   - `polling`: comprueba en cada `requestAnimationFrame` si cambió
 *     `video.currentTime`, como hacía el portal antiguo y el ejemplo oficial
 *     de MediaPipe. Sin hora de captura.
 *
 * Se empieza con el primero si el `<video>` lo tiene. Si no avisa en
 * `silenceTimeoutMs` con el vídeo listo, se pasa al segundo: un `<video>`
 * oculto (como el de la página de juego) puede no llegar a componerse y
 * entonces `requestVideoFrameCallback` no se dispara nunca.
 *
 * Sigue al elemento que devuelva `getVideo()` en cada fotograma, así que
 * sobrevive a que el `<video>` se recree (pasos del asistente de calibración).
 */

import type { FrameStamp } from './frame-pump';
import type { Scheduler } from './scheduler';

export type FrameSourceMode = 'idle' | 'video-frame-callback' | 'polling';

/** Lo que este módulo usa de un `<video>`. */
export type VideoFrameElement = {
    readyState: number;
    currentTime: number;
    requestVideoFrameCallback?: (
        callback: (now: number, metadata: { captureTime?: number }) => void,
    ) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
};

export type VideoFrameSourceOptions = {
    getVideo: () => VideoFrameElement | null;
    onFrame: (stamp: FrameStamp) => void;
    scheduler: Scheduler;
    requestAnimationFrame: (callback: () => void) => number;
    cancelAnimationFrame: (handle: number) => void;
    silenceTimeoutMs: number;
    onModeChange?: (mode: FrameSourceMode) => void;
};

/** `HTMLMediaElement.HAVE_CURRENT_DATA`: hay al menos una imagen. */
const HAVE_CURRENT_DATA = 2;

/** Una hora de captura más vieja que esto no es fiable (reloj de otra fuente). */
const MAX_CAPTURE_AGE_MS = 1000;

export class VideoFrameSource {
    private readonly options: VideoFrameSourceOptions;

    private currentMode: FrameSourceMode = 'idle';
    private animationHandle: number | null = null;

    private boundVideo: VideoFrameElement | null = null;
    private callbackHandle: number | null = null;
    private readySince: number | null = null;
    private lastCallbackAt: number | null = null;
    private lastPolledTime = -1;
    private frameKey = 0;

    constructor(options: VideoFrameSourceOptions) {
        this.options = options;
    }

    get mode(): FrameSourceMode {
        return this.currentMode;
    }

    start(): void {
        if (this.currentMode !== 'idle') {
            return;
        }

        // Si el `<video>` no tiene `requestVideoFrameCallback`, `bind` pasa
        // a sondeo en cuanto lo ve.
        this.setMode('video-frame-callback');
        this.tick();
    }

    stop(): void {
        if (this.animationHandle !== null) {
            this.options.cancelAnimationFrame(this.animationHandle);
            this.animationHandle = null;
        }

        this.unbind();
        this.setMode('idle');
    }

    private readonly tick = (): void => {
        this.animationHandle = null;

        if (this.currentMode === 'idle') {
            return;
        }

        const video = this.options.getVideo();

        if (video !== this.boundVideo) {
            this.unbind();
            this.bind(video);
        }

        if (video !== null) {
            if (video.readyState >= HAVE_CURRENT_DATA) {
                this.readySince ??= this.options.scheduler.now();
            }

            if (this.currentMode === 'polling') {
                this.poll(video);
            } else {
                this.checkSilence();
            }
        }

        this.animationHandle = this.options.requestAnimationFrame(this.tick);
    };

    private bind(video: VideoFrameElement | null): void {
        this.boundVideo = video;
        this.readySince = null;
        this.lastCallbackAt = null;
        this.lastPolledTime = -1;

        if (video !== null && this.currentMode === 'video-frame-callback') {
            this.requestCallback(video);
        }
    }

    private unbind(): void {
        const video = this.boundVideo;

        if (video !== null && this.callbackHandle !== null) {
            video.cancelVideoFrameCallback?.(this.callbackHandle);
        }

        this.callbackHandle = null;
        this.boundVideo = null;
    }

    private requestCallback(video: VideoFrameElement): void {
        if (typeof video.requestVideoFrameCallback !== 'function') {
            this.setMode('polling');

            return;
        }

        this.callbackHandle = video.requestVideoFrameCallback(
            (_now, metadata) => {
                if (
                    video !== this.boundVideo ||
                    this.currentMode !== 'video-frame-callback'
                ) {
                    return;
                }

                this.lastCallbackAt = this.options.scheduler.now();
                this.emit(this.validCaptureTime(metadata.captureTime));
                this.requestCallback(video);
            },
        );
    }

    private checkSilence(): void {
        if (this.readySince === null) {
            return;
        }

        const lastSign = Math.max(this.readySince, this.lastCallbackAt ?? 0);

        if (
            this.options.scheduler.now() - lastSign >=
            this.options.silenceTimeoutMs
        ) {
            const video = this.boundVideo;

            this.unbind();
            this.boundVideo = video;
            this.setMode('polling');
        }
    }

    private poll(video: VideoFrameElement): void {
        if (
            video.readyState < HAVE_CURRENT_DATA ||
            video.currentTime === this.lastPolledTime
        ) {
            return;
        }

        this.lastPolledTime = video.currentTime;
        this.emit(null);
    }

    private emit(captureTime: number | null): void {
        this.frameKey++;
        this.options.onFrame({ key: this.frameKey, captureTime });
    }

    private validCaptureTime(captureTime: number | undefined): number | null {
        if (captureTime === undefined || !Number.isFinite(captureTime)) {
            return null;
        }

        const now = this.options.scheduler.now();

        return captureTime <= now && now - captureTime <= MAX_CAPTURE_AGE_MS
            ? captureTime
            : null;
    }

    private setMode(mode: FrameSourceMode): void {
        if (mode === this.currentMode) {
            return;
        }

        this.currentMode = mode;
        this.options.onModeChange?.(mode);
    }
}
