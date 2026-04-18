import { Link, router, usePage } from '@inertiajs/react';
import { Bookmark, Heart, Gamepad2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { show } from '@/routes/catalog';
import { toggle as toggleFavorite } from '@/routes/catalog/favorite';
import { toggle as toggleSaved } from '@/routes/catalog/saved';
import type { Game } from '@/types';

type Props = {
    game: Game;
};

export function GameCard({ game }: Props) {
    const { auth } = usePage().props;
    const { t } = useTranslation();
    const isAuthenticated = !!auth?.user;

    const [isFavorite, setIsFavorite] = useState(
        game.user_interaction?.is_favorite ?? false,
    );
    const [isSaved, setIsSaved] = useState(
        game.user_interaction?.is_saved ?? false,
    );

    const handleToggleFavorite = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
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
        },
        [game.slug, isAuthenticated],
    );

    const handleToggleSaved = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
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
        },
        [game.slug, isAuthenticated],
    );

    return (
        <Link
            href={show.url(game.slug)}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
            {/* Cover */}
            <div className="relative aspect-4/3 overflow-hidden bg-muted">
                {game.cover_image ? (
                    <img
                        src={game.cover_image}
                        alt={game.name}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex size-full items-center justify-center bg-primary/5">
                        <Gamepad2 className="size-12 text-primary/30" />
                    </div>
                )}

                {/* Overlay con acciones */}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                {isAuthenticated && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white"
                                        onClick={handleToggleFavorite}
                                    >
                                        <Heart
                                            className={cn(
                                                'size-4 transition-all',
                                                isFavorite &&
                                                    'fill-red-500 text-red-500',
                                            )}
                                        />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {isFavorite
                                        ? t('catalog.favorite.remove')
                                        : t('catalog.favorite.add')}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white"
                                        onClick={handleToggleSaved}
                                    >
                                        <Bookmark
                                            className={cn(
                                                'size-4 transition-all',
                                                isSaved &&
                                                    'fill-primary text-primary',
                                            )}
                                        />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {isSaved
                                        ? t('catalog.saved.remove')
                                        : t('catalog.saved.add')}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}

                {/* Featured badge */}
                {game.is_featured && (
                    <Badge className="absolute top-2 left-2 bg-primary/90 text-xs">
                        ★
                    </Badge>
                )}
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col gap-1.5 p-3">
                <h3 className="line-clamp-1 text-sm leading-tight font-semibold text-foreground transition-colors group-hover:text-primary">
                    {game.name}
                </h3>

                {game.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {game.categories.slice(0, 2).map((cat) => (
                            <Badge
                                key={cat.id}
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px]"
                            >
                                {cat.name}
                            </Badge>
                        ))}
                    </div>
                )}

                <p className="mt-auto text-xs text-muted-foreground">
                    {t('catalog.plays', {
                        count: game.play_count.toLocaleString(),
                    })}
                </p>
            </div>
        </Link>
    );
}
