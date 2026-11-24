import { Link, router, usePage } from '@inertiajs/react';
import { Bookmark, Heart } from 'lucide-react';
import { useCallback, useState } from 'react';
import { FacialControlBadge } from '@/components/catalog/facial-control-badge';
import { GameCover } from '@/components/catalog/game-cover';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { show } from '@/routes/catalog';
import { toggle as toggleFavorite } from '@/routes/catalog/favorite';
import { toggle as toggleSaved } from '@/routes/catalog/saved';
import type { Game } from '@/types';

type Props = {
    game: Game;
};

/** Botón de favorito o guardar sobre la portada: siempre visible. */
function CoverAction({
    pressed,
    label,
    onClick,
    children,
}: {
    pressed: boolean;
    label: string;
    onClick: (event: React.MouseEvent) => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            title={label}
            onClick={onClick}
            className="flex size-8 cursor-pointer items-center justify-center rounded-control bg-scrim text-on-media transition-transform outline-none hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95"
        >
            {children}
        </button>
    );
}

/**
 * Tarjeta de un juego: portada (real o generada), nombre, insignias y
 * partidas. Toda la tarjeta lleva a la ficha (el enlace del nombre se estira
 * sobre ella); favorito y guardar son botones aparte, siempre visibles, así
 * que funcionan con teclado y en pantallas táctiles.
 */
export function GameCard({ game }: Props) {
    const { auth } = usePage().props;
    const { t, locale } = useTranslation();
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
        <article className="group relative flex flex-col overflow-hidden rounded-surface border bg-card shadow-surface transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-overlay has-[a:active]:translate-y-px has-[a:active]:shadow-none has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
            <div className="relative aspect-4/3 overflow-hidden border-b">
                <GameCover
                    slug={game.slug}
                    name={game.name}
                    image={game.cover_image}
                    showInitials
                />
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
                <h3 className="line-clamp-1 text-[15px] leading-tight font-bold text-foreground">
                    <Link
                        href={show.url(game.slug)}
                        className="outline-none after:absolute after:inset-0 after:content-['']"
                    >
                        {game.name}
                    </Link>
                </h3>

                {(game.categories.length > 0 ||
                    game.facial_control_support !== 'none') && (
                    <div className="flex flex-wrap gap-1">
                        <FacialControlBadge
                            support={game.facial_control_support}
                            short
                        />
                        {game.categories.slice(0, 2).map((cat) => (
                            <Badge key={cat.id} variant="default">
                                {cat.name}
                            </Badge>
                        ))}
                    </div>
                )}

                <p className="mt-auto text-xs text-muted-foreground tabular-nums">
                    {t('catalog.plays', {
                        count: game.play_count.toLocaleString(locale),
                    })}
                </p>
            </div>

            {isAuthenticated && (
                <div className="absolute top-2 right-2 z-10 flex gap-1.5">
                    <CoverAction
                        pressed={isFavorite}
                        label={
                            isFavorite
                                ? t('catalog.favorite.remove')
                                : t('catalog.favorite.add')
                        }
                        onClick={handleToggleFavorite}
                    >
                        <Heart
                            className={cn(
                                'size-4',
                                isFavorite && 'fill-current text-(--vou-pink)',
                            )}
                        />
                    </CoverAction>
                    <CoverAction
                        pressed={isSaved}
                        label={
                            isSaved
                                ? t('catalog.saved.remove')
                                : t('catalog.saved.add')
                        }
                        onClick={handleToggleSaved}
                    >
                        <Bookmark
                            className={cn(
                                'size-4',
                                isSaved && 'fill-current text-signal',
                            )}
                        />
                    </CoverAction>
                </div>
            )}
        </article>
    );
}
