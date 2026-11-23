import type { Canvas2DLike } from '@/lib/mediapipe/face-mesh-drawing';

type Call = [string, ...unknown[]];

/** Contexto 2D que apunta lo que se le pide. */
export class FakeContext implements Canvas2DLike {
    strokeStyle: unknown = '#000';
    lineWidth = 1;
    lineJoin: CanvasLineJoin = 'miter';
    lineCap: CanvasLineCap = 'butt';

    calls: Call[] = [];
    /** Cada `stroke()`: color, grosor y cuántas líneas llevaba el camino. */
    strokes: { color: unknown; width: number; segments: number }[] = [];

    private segments = 0;

    beginPath(): void {
        this.calls.push(['beginPath']);
        this.segments = 0;
    }

    moveTo(x: number, y: number): void {
        this.calls.push(['moveTo', x, y]);
    }

    lineTo(x: number, y: number): void {
        this.calls.push(['lineTo', x, y]);
        this.segments++;
    }

    stroke(): void {
        this.calls.push(['stroke']);
        this.strokes.push({
            color: this.strokeStyle,
            width: this.lineWidth,
            segments: this.segments,
        });
    }

    clearRect(x: number, y: number, width: number, height: number): void {
        this.calls.push(['clearRect', x, y, width, height]);
    }

    drawImage(
        image: CanvasImageSource,
        dx: number,
        dy: number,
        dWidth: number,
        dHeight: number,
    ): void {
        this.calls.push(['drawImage', image, dx, dy, dWidth, dHeight]);
    }
}

/** `OffscreenCanvas` falso con su contexto (o sin él). */
export class FakeCanvas {
    width = 300;
    height = 150;
    readonly context: FakeContext;
    private readonly available: boolean;

    constructor(context: FakeContext | null = new FakeContext()) {
        this.context = context ?? new FakeContext();
        this.available = context !== null;
    }

    getContext(type: '2d'): FakeContext | null {
        return type === '2d' && this.available ? this.context : null;
    }
}
