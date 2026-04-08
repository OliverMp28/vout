/**
 * Cabecera "Now Playing" de la página de juego embebido.
 *
 * Muestra: botón de retorno al catálogo, etiqueta de estado, título
 * y descripción del juego, y el trigger de panel en móvil.
 */

import { Link } from '@inertiajs/react';
import { ArrowLeft, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
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
    const isMobile = useIsMobile();

    const panelId = 'play-control-panel-sheet';

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
            {/* En móvil (<md) el sheet sale por abajo — UX natural con el pulgar. */}
            {/* En tablet (md..lg) sale por la derecha como drawer lateral. */}
            <div className="lg:hidden">
                <Sheet open={panelOpen} onOpenChange={onPanelOpenChange}>
                    <SheetTrigger asChild>
                        <Button
                            id="play-panel-trigger"
                            variant="secondary"
                            size="sm"
                            className="gap-2 shadow-sm transition-all duration-200 hover:shadow-md"
                            aria-expanded={panelOpen}
                            aria-controls={panelId}
                            aria-label={panelOpen ? t('play.panel.close_panel') : t('play.panel.open_panel')}
                        >
                            <Settings2 className="size-4" />
                            {t('play.panel.toggle')}
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        id={panelId}
                        side={isMobile ? 'bottom' : 'right'}
                        className={
                            isMobile
                                ? 'max-h-[85vh] rounded-t-2xl border-t-border/60 bg-card/95 backdrop-blur-xl'
                                : 'w-full border-l-border/60 bg-card/95 backdrop-blur-xl sm:max-w-sm'
                        }
                    >
                        <SheetHeader className="border-b border-border/50 pb-4">
                            <SheetTitle className="text-lg tracking-tight">
                                {t('play.panel.title')}
                            </SheetTitle>
                            <SheetDescription className="text-xs">
                                {t('play.panel.title_hint')}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="overflow-y-auto px-4 pb-6 pt-2">{panelContent}</div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
