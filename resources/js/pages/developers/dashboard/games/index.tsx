import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Gamepad2, ImageOff, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { GameStatusBadge } from '@/components/developers/games/status-badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { cn } from '@/lib/utils';
import developers from '@/routes/developers';
import type {
    DeveloperGameCardResource,
    DevelopersGameIndexProps,
} from '@/types';

const { games: gamesRoutes, apps: appsRoutes } = developers;

/**
 * Listado de juegos del dev autenticado (Fase 4.2, S1).
 *
 * Render server-side: la colección viaja por prop `games`. Cada tarjeta
 * muestra badge de estado y enlaza al detalle con prefetch. Empty state
 * con doble CTA según tenga o no apps activas.
 */
export default function DevelopersGamesIndex({
    games,
}: DevelopersGameIndexProps) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('developers.games.index.title')} />

            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            {t('developers.games.index.heading')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('developers.games.index.subheading')}
                        </p>
                    </div>

                    {games.length > 0 && (
                        <Button asChild className="gap-2 self-start">
                            <Link href={gamesRoutes.create().url} prefetch>
                                <Plus className="size-4" aria-hidden />
                                {t('developers.games.index.create_cta')}
                            </Link>
                        </Button>
                    )}
                </header>

                {games.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {games.map((game) => (
                            <li key={game.id}>
                                <GameCard game={game} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

DevelopersGamesIndex.layout = (page: ReactNode) => (
    <DevelopersLayout>{page}</DevelopersLayout>
);

function EmptyState() {
    const { t } = useTranslation();

    return (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Gamepad2 className="size-7" aria-hidden />
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
                {t('developers.games.index.empty.title')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
                {t('developers.games.index.empty.description')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Button asChild className="gap-2">
                    <Link href={gamesRoutes.create().url} prefetch>
                        <Plus className="size-4" aria-hidden />
                        {t('developers.games.index.empty.cta')}
                    </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                    <Link href={appsRoutes.create().url} prefetch>
                        {t('developers.games.index.empty.create_app_cta')}
                    </Link>
                </Button>
            </div>
        </div>
    );
}

type GameCardProps = {
    game: DeveloperGameCardResource;
};

function GameCard({ game }: GameCardProps) {
    const { t } = useTranslation();
    const updatedAt = game.updated_at
        ? new Date(game.updated_at).toLocaleDateString()
        : null;

    return (
        <Link
            href={gamesRoutes.show(game.slug).url}
            prefetch
            className={cn(
                'group flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm',
                'transition-[box-shadow,background-color] duration-300 ease-out',
                'hover:bg-accent/30 hover:shadow-md',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            )}
        >
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {game.cover_image ? (
                    <img
                        src={game.cover_image}
                        alt=""
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                        <ImageOff className="size-6" aria-hidden />
                        <span className="text-[11px] tracking-wider uppercase">
                            {t('developers.games.index.card.no_cover')}
                        </span>
                    </div>
                )}
                <div className="absolute top-2 right-2">
                    <GameStatusBadge status={game.status} />
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5 pt-0">
                <div className="min-w-0 space-y-1">
                    <h3 className="truncate text-base font-semibold tracking-tight">
                        {game.name}
                    </h3>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                        {game.slug}
                    </p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                    <span className="truncate">
                        {game.registered_app?.name ?? '—'}
                    </span>
                    {updatedAt && (
                        <span className="shrink-0 font-mono">
                            {t('developers.games.index.card.updated')}{' '}
                            {updatedAt}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-end">
                    <ArrowRight
                        className="size-4 text-muted-foreground/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                        aria-hidden
                    />
                </div>
            </div>
        </Link>
    );
}
