import { useMemo, useState } from 'react';
import type { CoverRect } from '@/lib/brand/generated-cover';
import {
    COVER_HEIGHT,
    COVER_WIDTH,
    coverInitials,
    generateCover,
} from '@/lib/brand/generated-cover';
import { cn } from '@/lib/utils';

type GameCoverProps = {
    slug: string;
    name: string;
    image?: string | null;
    className?: string;
    /** Muestra las iniciales del juego en una esquina (en tarjetas pequeñas). */
    showInitials?: boolean;
    /** Carga diferida de la imagen real (por defecto, sí). */
    lazy?: boolean;
};

type Part = 'sky' | 'cloud' | 'land' | 'edge' | 'plat';

/** Color de una parte de la portada: luz y croma del tema, tono del juego. */
function tone(part: Part, hue: number): string {
    return `oklch(var(--cover-${part}-l) var(--cover-${part}-c) ${hue})`;
}

function Rects({ rects }: { rects: CoverRect[] }) {
    return (
        <>
            {rects.map((rect, index) => (
                <rect
                    // Lista fija: el índice es estable.
                    key={index}
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                />
            ))}
        </>
    );
}

/**
 * Portada de un juego: la imagen que subió el desarrollador o, si no hay (o
 * no carga), una portada generada a partir del slug. Ocupa todo su contenedor;
 * el tamaño y la proporción los pone quien la usa.
 */
export function GameCover({
    slug,
    name,
    image,
    className,
    showInitials = false,
    lazy = true,
}: GameCoverProps) {
    // La URL que falló al cargar: si cambia la imagen, se vuelve a intentar.
    const [failedImage, setFailedImage] = useState<string | null>(null);
    const cover = useMemo(() => generateCover(slug), [slug]);

    if (image && failedImage !== image) {
        return (
            <img
                src={image}
                alt=""
                loading={lazy ? 'lazy' : 'eager'}
                decoding="async"
                onError={() => setFailedImage(image)}
                className={cn('size-full object-cover', className)}
            />
        );
    }

    return (
        <div
            className={cn('relative size-full', className)}
            data-generated-cover={slug}
        >
            <svg
                viewBox={`0 0 ${COVER_WIDTH} ${COVER_HEIGHT}`}
                preserveAspectRatio="xMidYMid slice"
                shapeRendering="crispEdges"
                aria-hidden="true"
                className="block size-full"
            >
                <rect
                    width={COVER_WIDTH}
                    height={COVER_HEIGHT}
                    style={{ fill: tone('sky', cover.hue) }}
                />
                <g style={{ fill: tone('cloud', cover.hue) }}>
                    <Rects rects={cover.clouds} />
                </g>
                <g style={{ fill: tone('land', cover.hue) }}>
                    <Rects rects={cover.land} />
                </g>
                <g style={{ fill: tone('edge', cover.hue) }}>
                    <Rects rects={cover.edge} />
                </g>
                <g style={{ fill: tone('plat', cover.hue) }}>
                    <Rects rects={cover.platforms} />
                </g>
            </svg>
            {showInitials && (
                <span
                    aria-hidden="true"
                    className="absolute bottom-2 left-2 rounded-[5px] bg-scrim px-1.5 pt-1 pb-0.5 font-pixel text-base leading-none text-on-media"
                >
                    {coverInitials(name)}
                </span>
            )}
        </div>
    );
}
