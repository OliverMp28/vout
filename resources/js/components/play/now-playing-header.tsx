/**
 * Cabecera "Now Playing" de la página de juego embebido.
 *
 * Muestra el botón de retorno al catálogo, la etiqueta de estado, el título
 * y la descripción del juego, y a la derecha la barra de herramientas de la
 * página (control facial, estado de la cámara).
 */

import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import catalog from '@/routes/catalog';

type NowPlayingHeaderProps = {
    gameName: string;
    gameDescription: string | null;
    /** Barra de herramientas de la página (a la derecha). */
    toolbar?: ReactNode;
};

export function NowPlayingHeader({
    gameName,
    gameDescription,
    toolbar,
}: NowPlayingHeaderProps) {
    const { t } = useTranslation();

    return (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                <Button
                    asChild
                    id="play-back-to-catalog"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={t('play.back_to_catalog')}
                >
                    <Link href={catalog.index.url()}>
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>

                <div className="min-w-0">
                    <p className="font-pixel-label text-base leading-none text-muted-foreground">
                        {t('play.now_playing')}
                    </p>
                    <h1 className="truncate text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">
                        {gameName}
                    </h1>
                    {gameDescription && (
                        <p className="mt-0.5 line-clamp-1 hidden text-xs text-muted-foreground sm:block">
                            {gameDescription}
                        </p>
                    )}
                </div>
            </div>

            {toolbar && <div className="shrink-0">{toolbar}</div>}
        </div>
    );
}
