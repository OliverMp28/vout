/**
 * Cabecera "Now Playing" de la página de juego embebido.
 *
 * Muestra: botón de retorno al catálogo, etiqueta de estado, título
 * y descripción del juego, y el trigger de panel en móvil.
 */

import { Link } from '@inertiajs/react';
import { ArrowLeft, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useTranslation } from '@/hooks/use-translation';
import catalog from '@/routes/catalog';

type NowPlayingHeaderProps = {
    gameName: string;
    gameDescription: string | null;
    panelOpen: boolean;
    onPanelOpenChange: (open: boolean) => void;
    /** Contenido del panel — se renderiza dentro del Sheet en móvil. */
    panelContent: React.ReactNode;
};

export function NowPlayingHeader({
    gameName,
    gameDescription,
    panelOpen,
    onPanelOpenChange,
    panelContent,
}: NowPlayingHeaderProps) {
    const { t } = useTranslation();

    return (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                <Button
                    asChild
                    id="play-back-to-catalog"
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0 rounded-full border-border/60 bg-background/60 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    aria-label={t('play.back_to_catalog')}
                >
                    <Link href={catalog.index.url()}>
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>

                <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-wider text-primary/80 uppercase">
                        {t('play.now_playing')}
                    </p>
                    <h1 className="truncate text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                        {gameName}
                    </h1>
                    {gameDescription && (
                        <p className="mt-0.5 line-clamp-1 hidden text-xs text-muted-foreground sm:block">
                            {gameDescription}
                        </p>
                    )}
                </div>
            </div>

            {/* Trigger del panel — solo visible en tablet/móvil */}
            <div className="lg:hidden">
                <Sheet open={panelOpen} onOpenChange={onPanelOpenChange}>
                    <SheetTrigger asChild>
                        <Button
                            id="play-panel-trigger"
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                        >
                            <Settings2 className="size-4" />
                            {t('play.panel.toggle')}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-sm">
                        <SheetHeader>
                            <SheetTitle>{t('play.panel.title')}</SheetTitle>
                        </SheetHeader>
                        <div className="px-4 pb-4">{panelContent}</div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
