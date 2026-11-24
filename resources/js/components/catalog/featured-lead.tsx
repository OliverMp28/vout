import { Link } from '@inertiajs/react';
import { Play } from 'lucide-react';
import { FacialControlBadge } from '@/components/catalog/facial-control-badge';
import { GameCover } from '@/components/catalog/game-cover';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { show as catalogShow } from '@/routes/catalog';
import { show as playShow } from '@/routes/play';
import type { Game } from '@/types';

type FeaturedLeadProps = {
    /** El juego destacado principal (la pieza grande). */
    lead: Game;
    /** Hasta dos juegos más, al lado. */
    others: Game[];
};

function SideTile({ game }: { game: Game }) {
    const { t, locale } = useTranslation();

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-surface border bg-card shadow-surface transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-overlay has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
            <div className="aspect-video overflow-hidden border-b">
                <GameCover
                    slug={game.slug}
                    name={game.name}
                    image={game.cover_image}
                    showInitials
                />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                    <h3 className="truncate font-bold">
                        <Link
                            href={catalogShow.url(game.slug)}
                            className="outline-none after:absolute after:inset-0 after:content-['']"
                        >
                            {game.name}
                        </Link>
                    </h3>
                    <p className="truncate text-sm text-muted-foreground tabular-nums">
                        {[
                            game.categories[0]?.name,
                            t('catalog.plays', {
                                count: game.play_count.toLocaleString(locale),
                            }),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                <FacialControlBadge
                    support={game.facial_control_support}
                    short
                />
            </div>
        </article>
    );
}

/**
 * Destacados de la portada en mosaico: un juego grande con "Jugar" y dos más
 * al lado. Fijo (nada rota solo) y sin textos de anuncio: portada, nombre,
 * datos reales y la acción.
 */
export function FeaturedLead({ lead, others }: FeaturedLeadProps) {
    const { t, locale } = useTranslation();
    const category = lead.categories[0]?.name;
    const sides = others.slice(0, 2);

    return (
        <section
            id="welcome-featured"
            aria-labelledby="welcome-featured-heading"
            className="grid gap-3"
        >
            <h2
                id="welcome-featured-heading"
                className="font-pixel-label text-xl leading-none text-muted-foreground"
            >
                {t('welcome.featured.label')}
            </h2>

            <div
                className={cn(
                    'grid gap-4',
                    sides.length > 0 &&
                        'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
                )}
            >
                <article className="flex flex-col overflow-hidden rounded-surface border bg-card shadow-surface">
                    <Link
                        href={catalogShow.url(lead.slug)}
                        tabIndex={-1}
                        aria-hidden="true"
                        className={cn(
                            'block aspect-video overflow-hidden border-b',
                            // Con dos juegos al lado, la portada crece hasta
                            // igualar su altura en vez de dejar un hueco.
                            sides.length > 1 &&
                                'lg:aspect-auto lg:min-h-0 lg:flex-1',
                        )}
                    >
                        <GameCover
                            slug={lead.slug}
                            name={lead.name}
                            image={lead.cover_image}
                            lazy={false}
                        />
                    </Link>
                    <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
                        <div className="min-w-0 space-y-1">
                            <h3
                                id="welcome-featured-title"
                                className="text-2xl leading-tight font-extrabold tracking-tight"
                            >
                                <Link
                                    href={catalogShow.url(lead.slug)}
                                    className="rounded-xs hover:underline hover:decoration-signal-strong hover:underline-offset-4"
                                >
                                    {lead.name}
                                </Link>
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                {category && <span>{category}</span>}
                                <span className="tabular-nums">
                                    {t('catalog.plays', {
                                        count: lead.play_count.toLocaleString(
                                            locale,
                                        ),
                                    })}
                                </span>
                                <FacialControlBadge
                                    support={lead.facial_control_support}
                                />
                            </div>
                        </div>
                        <Button asChild variant="play" size="lg">
                            <Link href={playShow.url(lead.slug)}>
                                <Play className="fill-current" />
                                {t('catalog.play')}
                            </Link>
                        </Button>
                    </div>
                </article>

                {sides.length > 0 && (
                    <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
                        {sides.map((game) => (
                            <SideTile key={game.id} game={game} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
