import { Clock, Flame, Gamepad2, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export type DashboardStats = {
    gamesPlayed: number;
    topCategoryName: string | null;
    totalPlays: number;
    estimatedMinutes: number;
};

type Props = {
    stats: DashboardStats;
};

type StatItem = {
    key: string;
    icon: LucideIcon;
    label: string;
    value: string;
    srValue?: string;
};

function formatMinutes(
    minutes: number,
    t: (k: string, p?: Record<string, string | number>) => string,
    locale: string,
): { display: string; sr: string } {
    if (minutes <= 0) {
        return {
            display: t('dashboard.stats.time_spent.zero'),
            sr: t('dashboard.stats.time_spent.zero'),
        };
    }

    if (minutes < 60) {
        const value = minutes.toLocaleString(locale);
        return {
            display: t('dashboard.stats.time_spent.minutes', { count: value }),
            sr: t('dashboard.stats.time_spent.minutes', { count: value }),
        };
    }

    const hours = Math.floor(minutes / 60);
    const capped = hours >= 99;
    const value = capped ? '99+' : hours.toLocaleString(locale);
    return {
        display: t('dashboard.stats.time_spent.hours', { count: value }),
        sr: t('dashboard.stats.time_spent.hours', { count: value }),
    };
}

export function QuickStatsCard({ stats }: Props) {
    const { t, locale } = useTranslation();

    const time = formatMinutes(stats.estimatedMinutes, t, locale);

    const items: StatItem[] = [
        {
            key: 'games_played',
            icon: Gamepad2,
            label: t('dashboard.stats.games_played'),
            value: stats.gamesPlayed.toLocaleString(locale),
        },
        {
            key: 'top_category',
            icon: Tag,
            label: t('dashboard.stats.top_category'),
            value:
                stats.topCategoryName ??
                t('dashboard.stats.top_category_empty'),
        },
        {
            key: 'total_plays',
            icon: Flame,
            label: t('dashboard.stats.total_plays'),
            value: stats.totalPlays.toLocaleString(locale),
        },
        {
            key: 'time_spent',
            icon: Clock,
            label: t('dashboard.stats.time_spent.label'),
            value: time.display,
            srValue: time.sr,
        },
    ];

    return (
        <section
            id="dashboard-quick-stats"
            aria-labelledby="dashboard-quick-stats-title"
            className="rounded-xl border bg-card p-5 shadow-sm"
        >
            <h2
                id="dashboard-quick-stats-title"
                className="text-sm font-semibold text-muted-foreground"
            >
                {t('dashboard.stats.title')}
            </h2>

            <dl className="mt-4 grid grid-cols-2 gap-4">
                {items.map(({ key, ...item }) => (
                    <StatItem key={key} {...item} />
                ))}
            </dl>
        </section>
    );
}

function StatItem({ icon: Icon, label, value, srValue }: StatItem) {
    return (
        <div className="flex items-start gap-3">
            <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                aria-hidden="true"
            >
                <Icon className="size-4 text-primary" />
            </div>
            <div className="min-w-0 space-y-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd
                    className="truncate text-base font-semibold tabular-nums"
                    title={srValue ?? value}
                >
                    {value}
                </dd>
            </div>
        </div>
    );
}
