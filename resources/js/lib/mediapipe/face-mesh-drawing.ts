/**
 * Dibujo de la vista de la cámara con la malla facial.
 *
 * Lo usa el worker (`preview-renderer.ts`) sobre un `OffscreenCanvas`: el
 * hilo principal, que es también el del juego, no dibuja nada. Sin DOM ni
 * MediaPipe: las conexiones entre puntos llegan del bundle en tiempo de
 * ejecución (`FaceLandmarker.FACE_LANDMARKS_*`) y el contexto 2D se inyecta,
 * así que se prueba con uno falso.
 *
 * Cada capa (malla, contornos, iris) se dibuja con **un solo trazo**: todas
 * sus líneas van en el mismo camino. La malla completa tiene más de 2.500
 * segmentos y trazarlos uno a uno (como hace `DrawingUtils`) cuesta varias
 * veces más.
 */

import type { MeshLevel, PreviewColors } from './types';

/** Punto normalizado de MediaPipe: [0, 1] sobre la imagen analizada. */
export type MeshPoint = { x: number; y: number };

export type MeshConnection = { start: number; end: number };

export type MeshConnections = {
    tesselation: MeshConnection[];
    contours: MeshConnection[];
    irises: MeshConnection[];
};

export type MeshLayer = keyof MeshConnections;

/** Qué capas lleva cada nivel, de abajo arriba. */
export const MESH_LAYERS: Record<MeshLevel, MeshLayer[]> = {
    off: [],
    contours: ['contours', 'irises'],
    full: ['tesselation', 'contours', 'irises'],
};

/** Grosor de cada capa, en píxeles CSS. */
const LAYER_LINE_WIDTH: Record<MeshLayer, number> = {
    tesselation: 0.75,
    contours: 1.75,
    irises: 1.25,
};

/** Lo que este módulo usa de un contexto 2D (de un lienzo o de un fake). */
export type Canvas2DLike = {
    strokeStyle: unknown;
    lineWidth: number;
    lineJoin: CanvasLineJoin;
    lineCap: CanvasLineCap;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    clearRect(x: number, y: number, width: number, height: number): void;
    drawImage(
        image: CanvasImageSource,
        dx: number,
        dy: number,
        dWidth: number,
        dHeight: number,
    ): void;
};

/**
 * Rectángulo que ocupa la imagen analizada dentro del lienzo, encuadrada como
 * `object-fit: cover` (la misma que el `<video>` de la vista): llena el
 * lienzo y recorta lo que sobra por los lados o por arriba y abajo.
 */
export type ImageFit = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export function coverFit(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
): ImageFit {
    if (sourceWidth <= 0 || sourceHeight <= 0) {
        return { x: 0, y: 0, width: targetWidth, height: targetHeight };
    }

    const scale = Math.max(
        targetWidth / sourceWidth,
        targetHeight / sourceHeight,
    );
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;

    return {
        x: (targetWidth - width) / 2,
        y: (targetHeight - height) / 2,
        width,
        height,
    };
}

/** Añade al camino actual las líneas de `connections` (sin trazarlas). */
export function addConnectionsToPath(
    context: Canvas2DLike,
    points: readonly MeshPoint[],
    connections: readonly MeshConnection[],
    fit: ImageFit,
): void {
    for (const { start, end } of connections) {
        const from = points[start];
        const to = points[end];

        if (from === undefined || to === undefined) {
            continue;
        }

        context.moveTo(fit.x + from.x * fit.width, fit.y + from.y * fit.height);
        context.lineTo(fit.x + to.x * fit.width, fit.y + to.y * fit.height);
    }
}

export type MeshStyle = {
    colors: PreviewColors;
    /** Píxeles del dispositivo por píxel CSS. */
    pixelRatio: number;
};

/** Dibuja la malla del nivel pedido: un trazo por capa. */
export function drawFaceMesh(
    context: Canvas2DLike,
    points: readonly MeshPoint[],
    connections: MeshConnections,
    level: MeshLevel,
    fit: ImageFit,
    style: MeshStyle,
): void {
    context.lineJoin = 'round';
    context.lineCap = 'round';

    for (const layer of MESH_LAYERS[level]) {
        if (connections[layer].length === 0) {
            continue;
        }

        context.strokeStyle =
            layer === 'tesselation' ? style.colors.mesh : style.colors.contour;
        context.lineWidth = LAYER_LINE_WIDTH[layer] * style.pixelRatio;
        context.beginPath();
        addConnectionsToPath(context, points, connections[layer], fit);
        context.stroke();
    }
}
