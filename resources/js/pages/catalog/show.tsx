import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Bookmark,
    Calendar,
    Globe,
    Heart,
    Play,
    Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { FacialControlBadge } from '@/components/catalog/facial-control-badge';
import { GameCover } from '@/components/catalog/game-cover';
import { GameGrid } from '@/components/catalog/game-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    useDeferredEngineWarmup,
    usePreloadDecision,
    useRuntimePrefetch,
} from '@/hooks/use-engine-preload';
import { useMascotContext } from '@/hooks/use-mascot-context';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { cn } from '@/lib/utils';
import { index as catalogIndex } from '@/routes/catalog';
import { toggle as toggleFavorite } from '@/routes/catalog/favorite';
import { toggle as toggleSaved } from '@/routes/catalog/saved';
import { show as playShow } from '@/routes/play';
import type { CatalogShowProps } from '@/types';

export default function CatalogShow({
    game: gameWrapper,
    userInteraction,
    related,
}: CatalogShowProps) {
    const game = gameWrapper.data;
    const { auth } = usePage().props;
    const { t, locale } = useTranslation();
    const isAuthenticated = !!auth?.user;

    // Desde aquí se entra a jugar: quien usa el control facial descarga ya
    // los ficheros del motor (solo red, a baja prioridad), y quien juega con
    // la cámara lo deja preparado. Nada si el juego no admite la cámara.
    const preloadDecision = usePreloadDecision('game-detail', {
        gameSupportsFacialControl: game.facial_control_support !== 'none',
    });
    useRuntimePrefetch(preloadDecision);
    useDeferredEngineWarmup(preloadDecision);

    const [isFavorite, setIsFavorite] = useState(
        userInteraction?.is_favorite ?? false,
    );
    const [isSaved, setIsSaved] = useState(userInteraction?.is_saved ?? false);

    useMascotContext([
        {
            id: 'catalog.show',
            when: !!game.embed_url,
            text: t('mascot.context.catalog.show', { game: game.name }),
        },
    ]);

    const handleToggleFavorite = useCallback(() => {
        if (!isAuthenticated) return;
        setIsFavorite((prev) => !prev);
        router.post(
            toggleFavorite.url(game.slug),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onError: () => setIsFavorite((prev) => !prev),
            },
        );
    }, [game.slug, isAuthenticated]);

    const handleToggleSaved = useCallback(() => {
        if (!isAuthenticated) return;
        setIsSaved((prev) => !prev);
        router.post(
            toggleSaved.url(game.slug),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onError: () => setIsSaved((prev) => !prev),
            },
        );
    }, [game.slug, isAuthenticated]);

    const category = game.categories[0];

    return (
        <PortalLayout>
            <Head title={game.name} />

            <div className="grid gap-10">
                <nav
                    aria-label={t('catalog.title')}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                    <Link
                        href={catalogIndex.url()}
                        className="inline-flex items-center gap-1.5 rounded-xs font-semibold hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" aria-hidden />
                        {t('catalog.title')}
                    </Link>
                    {category && (
                        <>
                            <span aria-hidden="true">/</span>
                            <span>{category.name}</span>
                        </>
                    )}
                </nav>

                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                    <div className="aspect-video overflow-hidden rounded-media border shadow-surface">
                        <GameCover
                            slug={game.slug}
                            name={game.name}
                            image={game.cover_image}
                            lazy={false}
                        />
                    </div>

                    <div className="flex flex-col gap-5">
                        <div className="space-y-3">
                            <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">
                                {game.name}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                    <Users className="size-4" aria-hidden />
                                    {t('catalog.play_count', {
                                        count: game.play_count.toLocaleString(
                                            locale,
                                        ),
                                    })}
                                </span>
                                {game.release_date && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Calendar
                                            className="size-4"
                                            aria-hidden
                                        />
                                        {new Date(
                                            game.release_date,
                                        ).toLocaleDateString(locale)}
                                    </span>
                                )}
                            </div>
                            {game.description && (
                                <p className="text-base leading-relaxed">
                                    {game.description}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {game.embed_url && (
                                <Button asChild variant="play" size="lg">
                                    <Link href={playShow.url(game.slug)}>
                                        <Play className="fill-current" />
                                        {t('catalog.play')}
                                    </Link>
                                </Button>
                            )}

                            {isAuthenticated && (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="icon-lg"
                                        onClick={handleToggleFavorite}
                                        aria-pressed={isFavorite}
                                        aria-label={
                                            isFavorite
                                                ? t('catalog.favorite.remove')
                                                : t('catalog.favorite.add')
                                        }
                                        title={
                                            isFavorite
                                                ? t('catalog.favorite.remove')
                                                : t('catalog.favorite.add')
                                        }
                                    >
                                        <Heart
                                            className={cn(
                                                isFavorite &&
                                                    'fill-current text-(--vou-pink)',
                                            )}
                                        />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="icon-lg"
                                        onClick={handleToggleSaved}
                                        aria-pressed={isSaved}
                                        aria-label={
                                            isSaved
                                                ? t('catalog.saved.remove')
                                                : t('catalog.saved.add')
                                        }
                                        title={
                                            isSaved
                                                ? t('catalog.saved.remove')
                                                : t('catalog.saved.add')
                                        }
                                    >
                                        <Bookmark
                                            className={cn(
                                                isSaved &&
                                                    'fill-current text-signal-edge',
                                            )}
                                        />
                                    </Button>
                                </>
                            )}
                        </div>

                        <dl className="divide-y rounded-surface border bg-surface-1 text-sm shadow-surface">
                            {game.facial_control_support !== 'none' && (
                                <div
                                    id="game-facial-control"
                                    className="grid gap-2 px-4 py-3"
                                >
                                    <dt className="font-pixel-label text-base leading-none text-muted-foreground">
                                        {t('facial_control.support.label')}
                                    </dt>
                                    <dd className="space-y-1.5">
                                        <FacialControlBadge
                                            support={
                                                game.facial_control_support
                                            }
                                        />
                                        <p className="text-muted-foreground">
                                            {t(
                                                `facial_control.detail.${game.facial_control_support}`,
                                            )}
                                        </p>
                                    </dd>
                                </div>
                            )}

                            {game.categories.length > 0 && (
                                <div className="grid gap-2 px-4 py-3">
                                    <dt className="font-pixel-label text-base leading-none text-muted-foreground">
                                        {t('catalog.categories_label')}
                                    </dt>
                                    <dd className="flex flex-wrap gap-1.5">
                                        {game.categories.map((cat) => (
                                            <Badge key={cat.id}>
                                                {cat.name}
                                            </Badge>
                                        ))}
                                    </dd>
                                </div>
                            )}

                            {game.developers.length > 0 && (
                                <div className="grid gap-2 px-4 py-3">
                                    <dt className="font-pixel-label text-base leading-none text-muted-foreground">
                                        {t('catalog.developers_label')}
                                    </dt>
                                    {game.developers.map((dev) => (
                                        <dd
                                            key={dev.id}
                                            className="flex items-center gap-2"
                                        >
                                            {dev.logo_url ? (
                                                <img
                                                    src={dev.logo_url}
                                                    alt=""
                                                    className="size-6 rounded-xs"
                                                />
                                            ) : (
                                                <span
                                                    aria-hidden="true"
                                                    className="flex size-6 items-center justify-center rounded-xs bg-surface-sunken text-xs font-bold"
                                                >
                                                    {dev.name[0]}
                                                </span>
                                            )}
                                            <span className="font-semibold">
                                                {dev.name}
                                            </span>
                                            {dev.website_url && (
                                                <a
                                                    href={dev.website_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-xs text-muted-foreground hover:text-foreground"
                                                    aria-label={t(
                                                        'catalog.developer_website',
                                                        { name: dev.name },
                                                    )}
                                                >
                                                    <Globe className="size-4" />
                                                </a>
                                            )}
                                        </dd>
                                    ))}
                                </div>
                            )}
                        </dl>
                    </div>
                </div>

                {related.data.length > 0 && (
                    <section
                        aria-labelledby="related-title"
                        className="grid gap-3"
                    >
                        <h2
                            id="related-title"
                            className="text-xl font-bold tracking-tight"
                        >
                            {t('catalog.related')}
                        </h2>
                        <GameGrid games={related.data} />
                    </section>
                )}
            </div>
        </PortalLayout>
    );
}
