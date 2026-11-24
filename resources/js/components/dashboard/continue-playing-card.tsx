import { Link } from '@inertiajs/react';
import { ArrowRight, Gamepad2, Play, Trophy } from 'lucide-react';
import { GameCover } from '@/components/catalog/game-cover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    usePreloadDecision,
    useRuntimePrefetch,
} from '@/hooks/use-engine-preload';
import { useTranslation } from '@/hooks/use-translation';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { cn } from '@/lib/utils';
import { index as catalogIndex } from '@/routes/catalog';
import { show as playShow } from '@/routes/play';
import type { Game } from '@/types';

type Props = {
    game: Game | null;
};

export function ContinuePlayingCard({ game }: Props) {
    const { t, locale } = useTranslation();
    const preloadDecision = usePreloadDecision('game-entry', {
        gameSupportsFacialControl:
            game !== null && game.facial_control_support !== 'none',
    });

    // "Seguir jugando" lleva directo al juego: quien usa el control facial
    // descarga ya los ficheros del motor (solo red, a baja prioridad), si el
    // juego admite la cámara.
    useRuntimePrefetch(preloadDecision);

    if (game === null) {
        return <ContinuePlayingEmpty />;
    }

    const lastPlayed = game.user_interaction?.last_played_at
        ? formatRelativeTime(
              game.user_interaction.last_played_at,
              (key, params) => t(key, params),
              locale,
          )
        : null;

    const bestScore = game.user_interaction?.best_score ?? null;
    const primaryCategory = game.categories[0] ?? null;

    return (
        <section
            id="dashboard-continue-playing"
            aria-labelledby="dashboard-continue-playing-title"
            className={cn(
                'relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm',
                'flex flex-col gap-0 md:flex-row md:items-stretch',
                'transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 hover:shadow-md',
            )}
        >
            <div
                className="relative aspect-video w-full shrink-0 overflow-hidden border-b md:aspect-auto md:w-64 md:border-r md:border-b-0"
                aria-hidden="true"
            >
                <GameCover
                    slug={game.slug}
                    name={game.name}
                    image={game.cover_image}
                />
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
                <div className="flex flex-col gap-2">
                    <span className="font-pixel-label text-base leading-none text-muted-foreground">
                        {t('dashboard.continue.eyebrow')}
                    </span>
                    <h2
                        id="dashboard-continue-playing-title"
                        className="text-xl leading-tight font-semibold"
                    >
                        {game.name}
                    </h2>
                    {primaryCategory && (
                        <div>
                            <Badge
                                variant="secondary"
                                className="text-[11px] font-normal"
                            >
                                {primaryCategory.name}
                            </Badge>
                        </div>
                    )}
                </div>

                <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    {lastPlayed && (
                        <div className="flex items-center gap-1.5">
                            <dt className="sr-only">
                                {t('dashboard.continue.last_played_label')}
                            </dt>
                            <dd>
                                {t('dashboard.continue.last_played', {
                                    time: lastPlayed,
                                })}
                            </dd>
                        </div>
                    )}
                    {bestScore !== null && (
                        <div className="flex items-center gap-1.5">
                            <Trophy
                                className="size-4 text-warning-text"
                                aria-hidden="true"
                            />
                            <dt className="sr-only">
                                {t('dashboard.continue.best_score_label')}
                            </dt>
                            <dd>
                                {t('dashboard.continue.best_score', {
                                    score: bestScore.toLocaleString(locale),
                                })}
                            </dd>
                        </div>
                    )}
                </dl>

                <div className="mt-auto pt-2">
                    <Button asChild size="lg" className="w-full sm:w-auto">
                        <Link href={playShow.url(game.slug)}>
                            <Play className="size-4" aria-hidden="true" />
                            {t('dashboard.continue.cta')}
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}

function ContinuePlayingEmpty() {
    const { t } = useTranslation();

    return (
        <section
            id="dashboard-continue-playing"
            aria-labelledby="dashboard-continue-playing-empty-title"
            className="flex flex-col items-start gap-3 rounded-surface border bg-card p-6 shadow-surface"
        >
            <div className="flex size-12 items-center justify-center rounded-control bg-surface-sunken">
                <Gamepad2 className="size-6 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-1">
                <h2
                    id="dashboard-continue-playing-empty-title"
                    className="text-lg font-semibold"
                >
                    {t('dashboard.continue.empty.title')}
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                    {t('dashboard.continue.empty.description')}
                </p>
            </div>
            <Button asChild variant="secondary">
                <Link href={catalogIndex.url()}>
                    {t('dashboard.continue.empty.cta')}
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </Button>
        </section>
    );
}
