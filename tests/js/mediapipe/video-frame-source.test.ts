import { describe, expect, test } from 'bun:test';

import type { FrameStamp } from '@/lib/mediapipe/frame-pump';
import { VideoFrameSource } from '@/lib/mediapipe/video-frame-source';
import type {
    FrameSourceMode,
    VideoFrameElement,
} from '@/lib/mediapipe/video-frame-source';

import { ManualScheduler } from '../support/manual-scheduler';

const SILENCE_MS = 1000;

type FrameCallback = (now: number, metadata: { captureTime?: number }) => void;

/** `<video>` falso. Con `withCallback`, tiene `requestVideoFrameCallback`. */
function fakeVideo(withCallback: boolean) {
    const callbacks = new Map<number, FrameCallback>();
    let nextHandle = 1;

    const video: VideoFrameElement = {
        readyState: 4,
        currentTime: 0,
    };

    if (withCallback) {
        video.requestVideoFrameCallback = (callback) => {
            const handle = nextHandle++;
            callbacks.set(handle, callback);

            return handle;
        };
        video.cancelVideoFrameCallback = (handle) => callbacks.delete(handle);
    }

    return {
        video,
        /** El navegador presenta una imagen nueva. */
        present(captureTime?: number) {
            const pending = [...callbacks.values()];
            callbacks.clear();
            pending.forEach((callback) => callback(0, { captureTime }));
        },
        get registered() {
            return callbacks.size;
        },
    };
}

function setup(initialVideo: VideoFrameElement | null) {
    const scheduler = new ManualScheduler();
    const frames: FrameStamp[] = [];
    const modes: FrameSourceMode[] = [];
    const animation: { callback: (() => void) | null } = { callback: null };
    let video = initialVideo;

    const source = new VideoFrameSource({
        getVideo: () => video,
        onFrame: (stamp) => frames.push(stamp),
        scheduler,
        requestAnimationFrame: (callback) => {
            animation.callback = callback;

            return 1;
        },
        cancelAnimationFrame: () => {
            animation.callback = null;
        },
        silenceTimeoutMs: SILENCE_MS,
        onModeChange: (mode) => modes.push(mode),
    });

    return {
        scheduler,
        source,
        frames,
        modes,
        setVideo(next: VideoFrameElement | null) {
            video = next;
        },
        /** Un fotograma de pantalla (requestAnimationFrame). */
        animationFrame(advanceMs = 16) {
            scheduler.advance(advanceMs);
            animation.callback?.();
        },
    };
}

describe('VideoFrameSource con requestVideoFrameCallback', () => {
    test('avisa de cada imagen nueva con su hora de captura', () => {
        const camera = fakeVideo(true);
        const { source, frames, scheduler } = setup(camera.video);

        source.start();
        scheduler.advance(100);
        camera.present(90);
        camera.present(95);

        expect(source.mode).toBe('video-frame-callback');
        expect(frames).toEqual([
            { key: 1, captureTime: 90 },
            { key: 2, captureTime: 95 },
        ]);
    });

    test('descarta horas de captura imposibles', () => {
        const camera = fakeVideo(true);
        const { source, frames, scheduler } = setup(camera.video);

        source.start();
        scheduler.advance(5000);
        camera.present(6000);
        camera.present(1000);
        camera.present(undefined);

        expect(frames.map((frame) => frame.captureTime)).toEqual([
            null,
            null,
            null,
        ]);
    });

    test('si no avisa con el vídeo listo, pasa a sondeo', () => {
        const camera = fakeVideo(true);
        const { source, frames, modes, animationFrame } = setup(camera.video);

        source.start();

        for (let elapsed = 0; elapsed < SILENCE_MS; elapsed += 100) {
            animationFrame(100);
        }

        expect(modes).toEqual(['video-frame-callback', 'polling']);
        expect(camera.registered).toBe(0);

        camera.video.currentTime = 0.5;
        animationFrame();

        expect(frames).toEqual([{ key: 1, captureTime: null }]);
    });

    test('sigue al <video> nuevo si se recrea', () => {
        const first = fakeVideo(true);
        const second = fakeVideo(true);
        const { source, frames, setVideo, animationFrame } = setup(first.video);

        source.start();
        setVideo(second.video);
        animationFrame();

        expect(first.registered).toBe(0);

        first.present(0);
        second.present(0);

        expect(frames).toHaveLength(1);
    });

    test('stop cancela el aviso pendiente', () => {
        const camera = fakeVideo(true);
        const { source, frames } = setup(camera.video);

        source.start();
        source.stop();
        camera.present(0);

        expect(source.mode).toBe('idle');
        expect(frames).toEqual([]);
    });
});

describe('VideoFrameSource por sondeo', () => {
    test('sin requestVideoFrameCallback, compara currentTime en cada fotograma', () => {
        const camera = fakeVideo(false);
        const { source, frames, animationFrame } = setup(camera.video);

        source.start();
        expect(source.mode).toBe('polling');

        animationFrame();
        expect(frames).toHaveLength(1);

        animationFrame();
        expect(frames).toHaveLength(1);

        camera.video.currentTime = 0.033;
        animationFrame();

        expect(frames).toEqual([
            { key: 1, captureTime: null },
            { key: 2, captureTime: null },
        ]);
    });

    test('no avisa mientras el vídeo no tiene imagen', () => {
        const camera = fakeVideo(false);
        const { source, frames, animationFrame } = setup(camera.video);

        camera.video.readyState = 1;
        source.start();
        animationFrame();

        expect(frames).toEqual([]);
    });

    test('sin <video> espera a que aparezca', () => {
        const camera = fakeVideo(false);
        const { source, frames, setVideo, animationFrame } = setup(null);

        source.start();
        animationFrame();
        expect(frames).toEqual([]);

        setVideo(camera.video);
        animationFrame();

        expect(frames).toHaveLength(1);
    });
});
