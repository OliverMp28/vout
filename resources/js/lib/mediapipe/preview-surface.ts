/**
 * El sitio de la página donde se ve la vista de la cámara con la malla.
 *
 * El worker dibuja en un `OffscreenCanvas` que se le cede
 * (`transferControlToOffscreen`). Un lienzo solo se puede ceder una vez, así
 * que cada sesión pide uno nuevo: `createCanvas` pone un `<canvas>` en el
 * contenedor (quitando el anterior) y lo cede. Así también es seguro con el
 * doble montaje de StrictMode.
 *
 * El tamaño del lienzo es el del contenedor en píxeles del dispositivo, con
 * el lado mayor limitado (`PREVIEW_MAX_SIZE`), y se sigue con
 * `ResizeObserver`.
 */

import { PREVIEW_MAX_SIZE } from './constants';
import type { PreviewSurfaceLike } from './gesture-engine';
import type { PreviewSize } from './types';

/** Tamaño del lienzo para un contenedor de `cssWidth` × `cssHeight`. */
export function previewCanvasSize(
    cssWidth: number,
    cssHeight: number,
    devicePixelRatio: number,
    maxSize: number = PREVIEW_MAX_SIZE,
): PreviewSize {
    const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
    const width = Math.max(1, cssWidth * ratio);
    const height = Math.max(1, cssHeight * ratio);
    const scale = Math.min(1, maxSize / Math.max(width, height));

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        pixelRatio: ratio * scale,
    };
}

/** Si el navegador puede ceder un lienzo a un worker. */
export function supportsPreviewSurface(): boolean {
    return (
        typeof HTMLCanvasElement !== 'undefined' &&
        typeof HTMLCanvasElement.prototype.transferControlToOffscreen ===
            'function' &&
        typeof ResizeObserver !== 'undefined'
    );
}

function sameSize(a: PreviewSize, b: PreviewSize): boolean {
    return (
        a.width === b.width &&
        a.height === b.height &&
        a.pixelRatio === b.pixelRatio
    );
}

export class PreviewSurface implements PreviewSurfaceLike {
    private canvas: HTMLCanvasElement | null = null;
    private observer: ResizeObserver | null = null;
    private readonly listeners = new Set<(size: PreviewSize) => void>();
    private lastSize: PreviewSize | null = null;

    constructor(private readonly container: HTMLElement) {}

    createCanvas(): { canvas: OffscreenCanvas; size: PreviewSize } | null {
        this.removeCanvas();

        const canvas = document.createElement('canvas');
        const size = this.measure();

        // Estilo en línea: el lienzo no lo pinta React y debe cubrir el
        // contenedor sea cual sea su tamaño.
        canvas.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;display:block';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.width = size.width;
        canvas.height = size.height;
        this.container.appendChild(canvas);

        try {
            const offscreen = canvas.transferControlToOffscreen();

            this.canvas = canvas;
            this.lastSize = size;

            return { canvas: offscreen, size };
        } catch {
            canvas.remove();

            return null;
        }
    }

    removeCanvas(): void {
        this.canvas?.remove();
        this.canvas = null;
    }

    onResize(listener: (size: PreviewSize) => void): () => void {
        this.listeners.add(listener);
        this.observe();

        return () => {
            this.listeners.delete(listener);

            if (this.listeners.size === 0) {
                this.observer?.disconnect();
                this.observer = null;
            }
        };
    }

    /** Quita el lienzo y deja de observar el contenedor. */
    dispose(): void {
        this.removeCanvas();
        this.listeners.clear();
        this.observer?.disconnect();
        this.observer = null;
    }

    private measure(): PreviewSize {
        const rect = this.container.getBoundingClientRect();

        return previewCanvasSize(
            rect.width,
            rect.height,
            window.devicePixelRatio,
        );
    }

    private observe(): void {
        if (this.observer !== null) {
            return;
        }

        this.observer = new ResizeObserver(() => {
            const size = this.measure();

            if (this.lastSize !== null && sameSize(this.lastSize, size)) {
                return;
            }

            this.lastSize = size;

            for (const listener of this.listeners) {
                listener(size);
            }
        });
        this.observer.observe(this.container);
    }
}
