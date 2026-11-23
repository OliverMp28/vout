/**
 * Vista de la cámara con la malla, del lado del worker.
 *
 * El hilo principal le cede un `OffscreenCanvas` (`ATTACH_PREVIEW`) y el
 * worker dibuja en él cada fotograma analizado, después de responder con sus
 * gestos: la imagen (modo `synced`) y la malla de ese mismo fotograma. El
 * navegador compone el lienzo sin pasar por el hilo principal.
 *
 * Sin dependencias del worker: el lienzo y el reloj se inyectan.
 */

import { coverFit, drawFaceMesh } from './face-mesh-drawing';
import type {
    Canvas2DLike,
    MeshConnections,
    MeshPoint,
} from './face-mesh-drawing';
import type { PreviewOptions, PreviewSize } from './types';

/** Lo que el renderer usa de un `OffscreenCanvas`. */
export type PreviewCanvasLike = {
    width: number;
    height: number;
    getContext(type: '2d'): unknown;
};

/** Un fotograma analizado, listo para dibujar. */
export type PreviewFrame = {
    image: CanvasImageSource;
    /** Tamaño de la imagen analizada (los puntos son relativos a ella). */
    width: number;
    height: number;
    /** Puntos de la cara, o null si no se vio ninguna. */
    landmarks: readonly MeshPoint[] | null;
};

const NO_CONNECTIONS: MeshConnections = {
    tesselation: [],
    outline: [],
    features: [],
};

export class PreviewRenderer {
    private readonly now: () => number;

    private canvas: PreviewCanvasLike | null = null;
    private context: Canvas2DLike | null = null;
    private options: PreviewOptions | null = null;
    private pixelRatio = 1;
    private connections: MeshConnections = NO_CONNECTIONS;

    constructor(now: () => number = () => performance.now()) {
        this.now = now;
    }

    get isAttached(): boolean {
        return this.context !== null;
    }

    /** Las conexiones de la malla, del bundle de MediaPipe. */
    setConnections(connections: MeshConnections): void {
        this.connections = connections;
    }

    attach(
        canvas: PreviewCanvasLike,
        size: PreviewSize,
        options: PreviewOptions,
    ): void {
        this.detach();

        const context = canvas.getContext('2d') as Canvas2DLike | null;

        if (context === null) {
            return;
        }

        this.canvas = canvas;
        this.context = context;
        this.options = options;
        this.resize(size);
    }

    resize(size: PreviewSize): void {
        const { canvas } = this;

        if (canvas === null) {
            return;
        }

        // Cambiar el tamaño borra el lienzo: solo si cambia.
        if (canvas.width !== size.width) {
            canvas.width = size.width;
        }

        if (canvas.height !== size.height) {
            canvas.height = size.height;
        }

        this.pixelRatio = size.pixelRatio;
    }

    setOptions(options: PreviewOptions): void {
        this.options = options;
    }

    /** Deja el lienzo transparente. */
    clear(): void {
        const { canvas, context } = this;

        if (canvas !== null && context !== null) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    /** Borra el lienzo y lo suelta. */
    detach(): void {
        this.clear();
        this.canvas = null;
        this.context = null;
        this.options = null;
    }

    /**
     * Dibuja un fotograma.
     *
     * @returns Lo que tardó, en ms, o null si no hay lienzo.
     */
    render(frame: PreviewFrame): number | null {
        const { canvas, context, options } = this;

        if (canvas === null || context === null || options === null) {
            return null;
        }

        const startedAt = this.now();
        const fit = coverFit(
            frame.width,
            frame.height,
            canvas.width,
            canvas.height,
        );

        if (options.mode === 'synced') {
            // Encuadrada como `cover`: tapa el fotograma anterior entero.
            context.drawImage(frame.image, fit.x, fit.y, fit.width, fit.height);
        } else {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (frame.landmarks !== null && options.mesh !== 'off') {
            drawFaceMesh(
                context,
                frame.landmarks,
                this.connections,
                options.mesh,
                fit,
                { colors: options.colors, pixelRatio: this.pixelRatio },
            );
        }

        return this.now() - startedAt;
    }
}
