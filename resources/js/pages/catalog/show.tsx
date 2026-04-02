import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Bookmark,
    Calendar,
    Gamepad2,
    Globe,
    Heart,
    Play,
    Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { GameGrid } from '@/components/catalog/game-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { cn } from '@/lib/utils';
import { index as catalogIndex } from '@/routes/catalog';
import { toggle as toggleFavorite } from '@/routes/catalog/favorite';
import { toggle as toggleSaved } from '@/routes/catalog/saved';
import type { CatalogShowProps } from '@/types';

export default function CatalogShow({
    game: gameWrapper,
    userInteraction,
    related,
}: CatalogShowProps) {
    const game = gameWrapper.data;
    const { auth } = usePage().props;
    const { t } = useTranslation();
    const isAuthenticated = !!auth?.user;

    const [isFavorite, setIsFavorite] = useState(
        userInteraction?.is_favorite ?? false,
    );
    const [isSaved, setIsSaved] = useState(
        userInteraction?.is_saved ?? false,
    );

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

    return (
        <PortalLayout>
            <Head title={game.name} />

            <div className="space-y-8">
                {/* Back */}
                <Link
                    href={catalogIndex.url()}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    {t('catalog.title')}
                </Link>

                {/* Hero */}
                <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                    {/* Cover */}
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                        {game.cover_image ? (
                            <img
                                src={game.cover_image}
                                alt={game.name}
                                className="size-full object-cover"
                            />
                        ) : (
                            <div className="flex size-full items-center justify-center bg-primary/5">
                                <Gamepad2 className="size-20 text-primary/20" />
                            </div>
                        )}
                    </div>

                    {/* Info sidebar */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold">
                                {game.name}
                            </h1>
                            {game.description && (
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    {game.description}
                                </p>
                            )}
                        </div>

                        {/* Categories */}
                        {game.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {game.categories.map((cat) => (
                                    <Badge
                                        key={cat.id}
                                        variant="secondary"
                                    >
                                        {cat.name}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Meta */}
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Users className="size-4" />
                                {t('catalog.play_count', {
                                    count: game.play_count.toLocaleString(),
                                })}
                            </div>
                            {game.release_date && (
                                <div className="flex items-center gap-2">
                                    <Calendar className="size-4" />
                                    {new Date(
                                        game.release_date,
                                    ).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-auto flex flex-col gap-2">
                            {game.embed_url && (
                                <Button size="lg" className="w-full">
                                    <Play className="mr-2 size-4" />
                                    {t('catalog.play')}
                                </Button>
                            )}

                            {isAuthenticated && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={handleToggleFavorite}
                                    >
                                        <Heart
                                            className={cn(
                                                'mr-2 size-4',
                                                isFavorite &&
                                                    'fill-red-500 text-red-500',
                                            )}
                                        />
                                        {isFavorite
                                            ? t('catalog.favorite.remove')
                                            : t('catalog.favorite.add')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={handleToggleSaved}
                                    >
                                        <Bookmark
                                            className={cn(
                                                'mr-2 size-4',
                                                isSaved &&
                                                    'fill-primary text-primary',
                                            )}
                                        />
                                        {isSaved
                                            ? t('catalog.saved.remove')
                                            : t('catalog.saved.add')}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Developers */}
                        {game.developers.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        {t('catalog.developers_label')}
                                    </h3>
                                    {game.developers.map((dev) => (
                                        <div
                                            key={dev.id}
                                            className="flex items-center gap-2"
                                        >
                                            {dev.logo_url ? (
                                                <img
                                                    src={dev.logo_url}
                                                    alt={dev.name}
                                                    className="size-6 rounded"
                                                />
                                            ) : (
                                                <div className="flex size-6 items-center justify-center rounded bg-muted text-xs font-bold">
                                                    {dev.name[0]}
                                                </div>
                                            )}
                                            <span className="text-sm font-medium">
                                                {dev.name}
                                            </span>
                                            {dev.website_url && (
                                                <a
                                                    href={dev.website_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-muted-foreground hover:text-primary"
                                                >
                                                    <Globe className="size-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Related */}
                {related.data.length > 0 && (
                    <div className="space-y-4">
                        <Separator />
                        <h2 className="text-lg font-semibold">
                            {t('catalog.related')}
                        </h2>
                        <GameGrid games={related.data} />
                    </div>
                )}
            </div>
        </PortalLayout>
    );
}
