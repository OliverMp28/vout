import { useId } from 'react';
import type { LogoRect } from '@/lib/brand/logo-shapes';
import { WORDMARK_RECTS, WORDMARK_SIZE } from '@/lib/brand/logo-shapes';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
};

/** Grosor del contorno y desplazamiento del relieve, en unidades de la rejilla. */
const OUTLINE = 20;
const DEPTH_X = 16;
const DEPTH_Y = 20;

const VIEW_BOX = [
    -OUTLINE / 2,
    -OUTLINE / 2,
    WORDMARK_SIZE.width + DEPTH_X + OUTLINE,
    WORDMARK_SIZE.height + DEPTH_Y + OUTLINE,
].join(' ');

export function PixelRects({ rects }: { rects: readonly LogoRect[] }) {
    return (
        <>
            {rects.map(([x, y, width, height]) => (
                <rect
                    key={`${x}-${y}-${width}-${height}`}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                />
            ))}
        </>
    );
}

/**
 * Wordmark "Vout" en píxeles: cara con degradado de la marca, contorno fino y
 * un relieve desplazado, como las teclas del portal. Los colores salen de los
 * tokens `--logo-*` de app.css, así que se adapta al tema claro y oscuro.
 */
export default function AppLogo({ className }: Props) {
    const gradientId = `vout-wordmark-${useId().replace(/[^\w-]/g, '')}`;

    return (
        <svg
            viewBox={VIEW_BOX}
            role="img"
            aria-label="Vout"
            className={cn('h-7 w-auto max-w-full select-none', className)}
            shapeRendering="crispEdges"
        >
            <defs>
                <linearGradient
                    id={gradientId}
                    gradientUnits="userSpaceOnUse"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={WORDMARK_SIZE.height}
                >
                    <stop
                        offset="0"
                        style={{ stopColor: 'var(--logo-from)' }}
                    />
                    <stop offset="1" style={{ stopColor: 'var(--logo-to)' }} />
                </linearGradient>
            </defs>
            <g transform={`translate(${DEPTH_X} ${DEPTH_Y})`}>
                <g
                    style={{
                        fill: 'var(--logo-outline)',
                        stroke: 'var(--logo-outline)',
                    }}
                    strokeWidth={OUTLINE}
                    strokeLinejoin="miter"
                >
                    <PixelRects rects={WORDMARK_RECTS} />
                </g>
                <g style={{ fill: 'var(--logo-depth)' }}>
                    <PixelRects rects={WORDMARK_RECTS} />
                </g>
            </g>
            <g
                style={{
                    fill: 'var(--logo-outline)',
                    stroke: 'var(--logo-outline)',
                }}
                strokeWidth={OUTLINE}
                strokeLinejoin="miter"
            >
                <PixelRects rects={WORDMARK_RECTS} />
            </g>
            <g fill={`url(#${gradientId})`}>
                <PixelRects rects={WORDMARK_RECTS} />
            </g>
        </svg>
    );
}
