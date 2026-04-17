import { Link } from '@inertiajs/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GameCard } from '@/components/catalog/game-card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { index as catalogIndex } from '@/routes/catalog';
import type { Game } from '@/types';

type Reason = {
    key: string;
    params: Record<string, string>;
};

type Props = {
    games: Game[];
    reason: Reason | null;
};

export function RecommendationsStrip({ games, reason }: Props) {
    const { t } = useTranslation();

    if (games.length === 0) {
        return <RecommendationsEmpty />;
    }

    const subheader = reason
        ? t(reason.key, reason.params)
        : t('dashboard.recommendations.fallback');

    return (
        <section
            id="dashboard-recommendations"
            aria-labelledby="dashboard-recommendations-title"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="space-y-1">
                    <h2
                        id="dashboard-recommendations-title"
                        className="flex items-center gap-2 text-lg font-semibold"
                    >
                        <Sparkles
                            className="size-5 text-primary"
                            aria-hidden="true"
                        />
                        {t('dashboard.recommendations.title')}
                    </h2>
                    <p className="text-sm text-muted-foreground">{subheader}</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                    <Link href={catalogIndex.url()}>
                        {t('dashboard.recommendations.browse')}
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {games.map((game) => (
                    <GameCard key={game.id} game={game} />
                ))}
            </div>
        </section>
    );
}

function RecommendationsEmpty() {
    const { t } = useTranslation();

    return (
        <section
            id="dashboard-recommendations"
            aria-labelledby="dashboard-recommendations-empty-title"
            className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6 shadow-sm"
        >
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-1">
                <h2
                    id="dashboard-recommendations-empty-title"
                    className="text-base font-semibold"
                >
                    {t('dashboard.recommendations.empty.title')}
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                    {t('dashboard.recommendations.empty.description')}
                </p>
            </div>
            <Button asChild variant="secondary" size="sm">
                <Link href={catalogIndex.url()}>
                    {t('dashboard.recommendations.empty.cta')}
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </Button>
        </section>
    );
}
