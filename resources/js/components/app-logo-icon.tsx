import { useId } from 'react';
import { PixelRects } from '@/components/app-logo';
import {
    ICON_RING_RECTS,
    ICON_SIZE,
    ICON_V_RECTS,
} from '@/lib/brand/logo-shapes';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
    /** Texto alternativo. Vacío (por defecto) si va junto al nombre "Vout". */
    alt?: string;
};

/** Grosor del contorno y desplazamiento del relieve, en unidades de la rejilla. */
const OUTLINE = 2.4;
const DEPTH = 1.6;

const VIEW_BOX = [
    -OUTLINE / 2,
    -OUTLINE / 2,
    ICON_SIZE.width + DEPTH + OUTLINE,
    ICON_SIZE.height + DEPTH + OUTLINE,
].join(' ');

/**
 * Icono "V" de Vout: la V en píxeles con el degradado y el relieve del
 * wordmark, rodeada por su contorno escalonado. Colores de los tokens
 * `--logo-*` de app.css.
 */
export default function AppLogoIcon({ className, alt = '' }: Props) {
    const gradientId = `vout-icon-${useId().replace(/[^\w-]/g, '')}`;
    const decorative = alt === '';

    return (
        <svg
            viewBox={VIEW_BOX}
            role={decorative ? undefined : 'img'}
            aria-label={decorative ? undefined : alt}
            aria-hidden={decorative ? true : undefined}
            className={cn('h-auto w-8 select-none', className)}
            shapeRendering="crispEdges"
        >
            <defs>
                <linearGradient
                    id={gradientId}
                    gradientUnits="userSpaceOnUse"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={ICON_SIZE.height}
                >
                    <stop
                        offset="0"
                        style={{ stopColor: 'var(--logo-from)' }}
                    />
                    <stop offset="1" style={{ stopColor: 'var(--logo-to)' }} />
                </linearGradient>
            </defs>
            <g style={{ fill: 'var(--logo-ring)' }}>
                <PixelRects rects={ICON_RING_RECTS} />
            </g>
            <g transform={`translate(${DEPTH} ${DEPTH})`}>
                <g
                    style={{
                        fill: 'var(--logo-outline)',
                        stroke: 'var(--logo-outline)',
                    }}
                    strokeWidth={OUTLINE}
                    strokeLinejoin="miter"
                >
                    <PixelRects rects={ICON_V_RECTS} />
                </g>
                <g style={{ fill: 'var(--logo-depth)' }}>
                    <PixelRects rects={ICON_V_RECTS} />
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
                <PixelRects rects={ICON_V_RECTS} />
            </g>
            <g fill={`url(#${gradientId})`}>
                <PixelRects rects={ICON_V_RECTS} />
            </g>
        </svg>
    );
}
