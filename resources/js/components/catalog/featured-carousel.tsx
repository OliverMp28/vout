import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Gamepad2, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { show } from '@/routes/catalog';
import type { Game } from '@/types';

type Props = {
    games: Game[];
};

export function FeaturedCarousel({ games }: Props) {
    const { t } = useTranslation();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isUserInteracting, setIsUserInteracting] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [progressKey, setProgressKey] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const interactionTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const thumbnailListRef = useRef<HTMLDivElement>(null);

    const goTo = useCallback(
        (index: number, fromUser = false) => {
            if (isTransitioning || index === activeIndex) return;
            setIsTransitioning(true);
            setActiveIndex(index);
            setProgressKey((k) => k + 1);
            if (fromUser) {
                setIsUserInteracting(true);
                if (interactionTimerRef.current)
                    clearTimeout(interactionTimerRef.current);
                // Resume auto-advance after 8s of no interaction
                interactionTimerRef.current = setTimeout(
                    () => setIsUserInteracting(false),
                    8000,
                );
            }
            setTimeout(() => setIsTransitioning(false), 700);
        },
        [activeIndex, isTransitioning],
    );

    const goNext = useCallback(() => {
        goTo((activeIndex + 1) % games.length);
    }, [activeIndex, games.length, goTo]);

    const goPrev = useCallback(() => {
        goTo((activeIndex - 1 + games.length) % games.length);
    }, [activeIndex, games.length, goTo]);

    // Scroll active thumbnail into view
    useEffect(() => {
        const list = thumbnailListRef.current;
        if (!list) return;
        const activeThumb = list.querySelector(
            `[data-thumb-index="${activeIndex}"]`,
        ) as HTMLElement | null;
        if (activeThumb) {
            activeThumb.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [activeIndex]);

    useEffect(() => {
        if (isHovered || isUserInteracting || games.length <= 1) return;

        timerRef.current = setTimeout(goNext, 6500);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [activeIndex, isHovered, isUserInteracting, goNext, games.length]);

    // Keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goPrev();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                goNext();
            }
        },
        [goNext, goPrev],
    );

    if (games.length === 0) return null;

    const activeGame = games[activeIndex];
    const hasMultiple = games.length > 1;

    return (
        <section
            className={cn(
                'group/carousel relative overflow-hidden rounded-2xl',
                'shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/10',
                'dark:ring-white/5',
            )}
            style={{ height: 'clamp(340px, 50vw, 560px)' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onKeyDown={handleKeyDown}
            aria-label={t('carousel.label')}
            aria-roledescription="carousel"
        >
            {/* Background slides — crossfade stack with Ken Burns on active */}
            {games.map((game, index) => (
                <div
                    key={game.id}
                    aria-hidden={index !== activeIndex}
                    className={cn(
                        'absolute inset-0 transition-opacity duration-700 ease-in-out',
                        index === activeIndex ? 'opacity-100' : 'opacity-0',
                    )}
                >
                    {game.cover_image ? (
                        <img
                            key={`${game.id}-${index === activeIndex ? progressKey : 'idle'}`}
                            src={game.cover_image}
                            alt=""
                            className={cn(
                                'size-full object-cover',
                                index === activeIndex
                                    ? 'carousel-ken-burns'
                                    : 'scale-105',
                            )}
                            loading={index === 0 ? 'eager' : 'lazy'}
                        />
                    ) : (
                        <div
                            className="size-full"
                            style={{
                                background:
                                    'linear-gradient(135deg, var(--vout-gradient-start), var(--vout-gradient-end))',
                            }}
                        />
                    )}
                    {/* Cinematic overlays — darken bottom, brand-tinted sides */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/5" />
                    <div className="absolute inset-0 bg-linear-to-r from-black/65 via-transparent to-transparent" />
                    {/* Subtle brand tint on the right edge for warmth */}
                    <div
                        className="absolute inset-y-0 right-0 w-1/3 opacity-40 mix-blend-soft-light"
                        style={{
                            background:
                                'linear-gradient(270deg, var(--vout-gradient-end), transparent)',
                        }}
                        aria-hidden="true"
                    />
                    {/* Vignette — darkens corners to anchor attention on content */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                'radial-gradient(ellipse 90% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)',
                        }}
                        aria-hidden="true"
                    />
                </div>
            ))}

            {/* Fallback icon when no cover */}
            {!activeGame.cover_image && (
                <div className="absolute inset-0 z-0 flex items-center justify-center opacity-10">
                    <Gamepad2 className="size-32 text-white" />
                </div>
            )}

            {/* Foreground content — game info */}
            <div
                key={`content-${activeIndex}`}
                className="carousel-slide-enter relative z-10 flex h-full flex-col justify-end"
            >
                {/* Game info — sits above the thumbnail strip */}
                <div className="px-6 pb-4 md:px-10">
                    {/* Category badges */}
                    {activeGame.categories.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                            {activeGame.categories.slice(0, 3).map((cat) => (
                                <Badge
                                    key={cat.id}
                                    variant="secondary"
                                    className="border border-white/20 bg-white/15 text-xs text-white backdrop-blur-sm"
                                >
                                    {cat.name}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Game name */}
                    <h2 className="mb-2 text-2xl leading-tight font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
                        {activeGame.name}
                    </h2>

                    {/* Description — 2 lines max */}
                    {activeGame.description && (
                        <p className="mb-4 line-clamp-2 max-w-xl text-sm text-white/80 drop-shadow-sm md:text-base">
                            {activeGame.description}
                        </p>
                    )}

                    {/* CTA buttons */}
                    <div className="flex items-center gap-3">
                        <Button
                            asChild
                            id={`btn-carousel-play-${activeGame.slug}`}
                            size="sm"
                            className="gap-2 bg-white font-semibold text-black shadow-lg hover:bg-white/90 md:h-10 md:px-5"
                        >
                            <Link href={show.url(activeGame.slug)}>
                                <Play className="size-4 fill-current" />
                                {t('catalog.play')}
                            </Link>
                        </Button>
                        <Button
                            asChild
                            id={`btn-carousel-details-${activeGame.slug}`}
                            variant="secondary"
                            size="sm"
                            className="gap-2 border-white/25 bg-white/15 font-medium text-white backdrop-blur-sm hover:bg-white/25 md:h-10 md:px-5"
                        >
                            <Link href={show.url(activeGame.slug)}>
                                {t('catalog.details')}
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Thumbnail selector strip */}
                {hasMultiple && (
                    <div className="relative">
                        {/* Strip backdrop — dark gradient that blends into the content above */}
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />

                        <div
                            ref={thumbnailListRef}
                            className="relative z-10 flex gap-2.5 overflow-x-auto px-6 pt-3 pb-4 md:px-10 md:pb-5"
                            role="tablist"
                            aria-label={t('carousel.indicators')}
                            style={{
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                            }}
                        >
                            {games.map((game, index) => {
                                const isActive = index === activeIndex;
                                return (
                                    <button
                                        key={game.id}
                                        id={`btn-carousel-thumb-${index}`}
                                        data-thumb-index={index}
                                        role="tab"
                                        aria-selected={isActive}
                                        aria-label={`${t('carousel.select_game')}: ${game.name}`}
                                        onClick={() => goTo(index, true)}
                                        className={cn(
                                            'group/thumb relative shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300',
                                            'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
                                            isActive
                                                ? 'border-primary opacity-100 shadow-[0_0_14px_2px_var(--color-primary)]'
                                                : 'border-white/15 opacity-50 hover:border-white/40 hover:opacity-85',
                                        )}
                                        style={{
                                            width: '100px',
                                            height: '68px',
                                        }}
                                    >
                                        {/* Cover image or gradient fallback */}
                                        {game.cover_image ? (
                                            <img
                                                src={game.cover_image}
                                                alt=""
                                                className="size-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div
                                                className="size-full"
                                                style={{
                                                    background:
                                                        'linear-gradient(135deg, var(--vout-gradient-start), var(--vout-gradient-end))',
                                                }}
                                            >
                                                <Gamepad2 className="absolute inset-0 m-auto size-6 text-white/30" />
                                            </div>
                                        )}

                                        {/* Dark gradient overlay for text legibility */}
                                        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />

                                        {/* Game name at bottom */}
                                        <span className="absolute right-0 bottom-0 left-0 line-clamp-2 px-1.5 pb-1 text-center text-[9px] leading-tight font-semibold text-white drop-shadow-sm">
                                            {game.name}
                                        </span>

                                        {/* Active indicator: primary-colored bottom bar */}
                                        {isActive &&
                                            !isHovered &&
                                            !isUserInteracting && (
                                                <span
                                                    key={progressKey}
                                                    className="carousel-progress-bar absolute bottom-0 left-0 h-0.5 w-full bg-primary"
                                                />
                                            )}

                                        <span className="sr-only">
                                            {game.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Prev / Next arrows — semi-visible by default, prominent on hover */}
            {hasMultiple && (
                <>
                    <button
                        id="btn-carousel-prev"
                        onClick={goPrev}
                        aria-label={t('carousel.prev')}
                        className={cn(
                            'absolute top-1/3 left-3 z-20 -translate-y-1/2 rounded-full border border-white/25 bg-black/45 p-2.5 text-white backdrop-blur-sm transition-all duration-300',
                            'hover:scale-110 hover:border-white/50 hover:bg-black/70',
                            'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
                            'opacity-40 group-hover/carousel:opacity-100',
                        )}
                    >
                        <ChevronLeft className="size-5" />
                    </button>
                    <button
                        id="btn-carousel-next"
                        onClick={goNext}
                        aria-label={t('carousel.next')}
                        className={cn(
                            'absolute top-1/3 right-3 z-20 -translate-y-1/2 rounded-full border border-white/25 bg-black/45 p-2.5 text-white backdrop-blur-sm transition-all duration-300',
                            'hover:scale-110 hover:border-white/50 hover:bg-black/70',
                            'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
                            'opacity-40 group-hover/carousel:opacity-100',
                        )}
                    >
                        <ChevronRight className="size-5" />
                    </button>
                </>
            )}
        </section>
    );
}
