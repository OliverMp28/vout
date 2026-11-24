import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { FeaturedLead } from '@/components/catalog/featured-lead';
import { GameCard } from '@/components/catalog/game-card';
import { GesturesHowto } from '@/components/catalog/gestures-howto';
import { VouSvg } from '@/components/mascot/vou-svg';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { login, register } from '@/routes';
import { index as catalogIndex } from '@/routes/catalog';
import { landing as developersLanding } from '@/routes/developers';
import type { Category, Game, WelcomeProps } from '@/types';

function ViewAll({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 rounded-xs text-sm font-semibold underline decoration-border-strong underline-offset-4 hover:decoration-signal-strong"
        >
            {label}
            <ArrowRight className="size-3.5" aria-hidden />
        </Link>
    );
}

function Shelf({
    id,
    title,
    games,
    viewAllHref,
    viewAllLabel,
}: {
    id: string;
    title: string;
    games: Game[];
    viewAllHref?: string;
    viewAllLabel?: string;
}) {
    return (
        <section id={id} aria-labelledby={`${id}-title`}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2
                    id={`${id}-title`}
                    className="text-xl font-bold tracking-tight"
                >
                    {title}
                </h2>
                {viewAllHref && viewAllLabel && (
                    <ViewAll href={viewAllHref} label={viewAllLabel} />
                )}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {games.map((game) => (
                    <GameCard key={game.id} game={game} />
                ))}
            </div>
        </section>
    );
}

function CategoryKeys({ categories }: { categories: Category[] }) {
    const { t } = useTranslation();

    return (
        <section
            id="section-categories"
            aria-labelledby="section-categories-title"
        >
            <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2
                    id="section-categories-title"
                    className="text-xl font-bold tracking-tight"
                >
                    {t('welcome.categories.title')}
                </h2>
                <ViewAll
                    href={catalogIndex.url()}
                    label={t('welcome.categories.all')}
                />
            </div>
            <ul className="flex flex-wrap gap-2.5">
                {categories.map((category) => (
                    <li key={category.id}>
                        <Link
                            href={catalogIndex.url({
                                query: { categories: [category.slug] },
                            })}
                            className="inline-flex h-10 items-center gap-2 rounded-control border border-border-strong bg-key-light px-4 font-semibold shadow-[0_3px_0_0_var(--key-light-edge)] transition-[transform,box-shadow,background-color] hover:bg-surface-hover active:translate-y-[3px] active:shadow-none"
                        >
                            {category.name}
                            {category.games_count !== undefined && (
                                <span className="font-mono text-xs font-normal text-muted-foreground">
                                    {category.games_count}
                                </span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Portada. Para quien llega por primera vez: qué es Vout en una línea, los
 * destacados, las categorías, los juegos con gestos y cómo funcionan. Para
 * quien ya tiene cuenta: sus últimas partidas arriba y lo nuevo debajo.
 * Funciona con un juego, con cuarenta y sin ninguno.
 */
export default function Welcome({
    featured,
    popular,
    gestureGames,
    newest,
    recentGames,
    categories,
    canRegister,
}: WelcomeProps) {
    const { auth } = usePage().props;
    const { t } = useTranslation();
    const isGuest = !auth?.user;

    // La pieza grande es el primer destacado (o el más jugado); al lado, más
    // destacados o, si faltan, los más jugados que no estén ya.
    const lead = featured.data[0] ?? popular.data[0];
    const sides = [...featured.data, ...popular.data]
        .filter(
            (game, index, all) =>
                game.id !== lead?.id &&
                all.findIndex((other) => other.id === game.id) === index,
        )
        .slice(0, 2);
    const hasGames = lead !== undefined;

    // Con un catálogo pequeño las filas se repiten: "Más jugados" se salta lo
    // que ya está en destacados y "Recién llegados" solo sale si trae al
    // menos dos juegos que no se hayan visto más arriba.
    const shownIds = new Set(
        [lead, ...sides].flatMap((game) => (game ? [game.id] : [])),
    );
    const popularRest = popular.data.filter((game) => !shownIds.has(game.id));
    const popularShelf = popularRest.slice(0, popularRest.length >= 8 ? 8 : 4);
    const showPopular = popularShelf.length >= 4;

    if (showPopular) {
        popularShelf.forEach((game) => shownIds.add(game.id));
    }

    const showNewest =
        newest.data.length >= 4 &&
        newest.data.filter((game) => !shownIds.has(game.id)).length >= 2;
    const firstName = auth?.user?.name.split(' ')[0] ?? '';

    return (
        <PortalLayout>
            <Head title={t('portal.title')} />

            <div className="grid gap-12">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-2xl space-y-1.5">
                        <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">
                            {isGuest
                                ? t('welcome.hero.title')
                                : t('welcome.greeting.title', {
                                      name: firstName,
                                  })}
                        </h1>
                        <p className="text-base text-muted-foreground">
                            {isGuest
                                ? t('welcome.hero.subtitle')
                                : t('welcome.greeting.subtitle')}
                        </p>
                    </div>
                    <Button
                        asChild
                        variant="secondary"
                        id="btn-welcome-explore"
                    >
                        <Link href={catalogIndex.url()}>
                            {t('welcome.hero.cta')}
                            <ArrowRight />
                        </Link>
                    </Button>
                </header>

                {recentGames.data.length > 0 && (
                    <Shelf
                        id="section-recent"
                        title={t('welcome.recent.title')}
                        games={recentGames.data}
                    />
                )}

                {hasGames ? (
                    <FeaturedLead lead={lead} others={sides} />
                ) : (
                    <section
                        id="welcome-empty"
                        className="flex flex-col items-center gap-4 rounded-surface border bg-surface-1 px-6 py-12 text-center shadow-surface"
                    >
                        <div className="size-24" aria-hidden="true">
                            <VouSvg />
                        </div>
                        <h2 className="text-xl font-bold">
                            {t('welcome.empty.title')}
                        </h2>
                        <p className="max-w-md text-muted-foreground">
                            {t('welcome.empty.desc')}
                        </p>
                        <Button asChild variant="secondary">
                            <Link href={developersLanding.url()}>
                                {t('welcome.empty.action')}
                            </Link>
                        </Button>
                    </section>
                )}

                {categories.data.length > 1 && (
                    <CategoryKeys categories={categories.data} />
                )}

                {gestureGames.data.length > 0 && (
                    <Shelf
                        id="section-gestures"
                        title={t('welcome.gestures.title')}
                        games={gestureGames.data}
                        viewAllHref={catalogIndex.url({ query: { face: 1 } })}
                        viewAllLabel={t('welcome.view_all')}
                    />
                )}

                {isGuest && <GesturesHowto />}

                {showPopular && (
                    <Shelf
                        id="section-popular"
                        title={t('welcome.popular.title')}
                        games={popularShelf}
                        viewAllHref={catalogIndex.url()}
                        viewAllLabel={t('welcome.view_all')}
                    />
                )}

                {showNewest && (
                    <Shelf
                        id="section-newest"
                        title={t('welcome.newest.title')}
                        games={newest.data}
                        viewAllHref={catalogIndex.url({
                            query: { sort: 'newest' },
                        })}
                        viewAllLabel={t('welcome.view_all')}
                    />
                )}

                {canRegister && isGuest && (
                    <section
                        aria-label={t('welcome.register_cta.action')}
                        className="flex flex-col gap-4 rounded-surface border bg-surface-sunken px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="space-y-1">
                            <p className="font-pixel-label text-lg leading-none text-muted-foreground">
                                {t('welcome.register_cta.label')}
                            </p>
                            <p className="max-w-xl">
                                {t('welcome.register_cta.subtitle')}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            <Button asChild id="btn-welcome-register">
                                <Link href={register()}>
                                    {t('welcome.register_cta.action')}
                                </Link>
                            </Button>
                            <Link
                                href={login()}
                                className="rounded-xs text-sm font-semibold underline decoration-border-strong underline-offset-4 hover:decoration-signal-strong"
                            >
                                {t('welcome.register_cta.login')}
                            </Link>
                        </div>
                    </section>
                )}
            </div>
        </PortalLayout>
    );
}
