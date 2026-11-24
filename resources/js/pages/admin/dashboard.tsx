import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, History } from 'lucide-react';
import type { ReactNode } from 'react';
import { MetricCard, MetricGrid } from '@/components/admin/metric-card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type {
    AdminMetricKey,
    AdminMetrics,
    AdminRecentActivityItem,
} from '@/types';

const { games: gamesRoutes, apps: appsRoutes, audit: auditRoutes } = admin;

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

type MetricSpec = {
    key: AdminMetricKey;
    labelKey: string;
    tone: (value: number) => Tone;
    hintKey?: string;
    action?: ReactNode;
};

type Props = {
    metrics: AdminMetrics;
    recentActivity: AdminRecentActivityItem[];
};

/**
 * Formatea un ISO date string a una representación localizada según el
 * locale activo del portal. Silencioso frente a entradas nulas o inválidas.
 */
function formatTimestamp(iso: string | null, locale: string): string {
    if (!iso) {
        return '—';
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function shortMorph(fqcn: string | null): string | null {
    if (!fqcn) {
        return null;
    }

    const parts = fqcn.split('\\');

    return parts[parts.length - 1] || fqcn;
}

export default function AdminDashboard({ metrics, recentActivity }: Props) {
    const { t, locale } = useTranslation();

    const specs: MetricSpec[] = [
        {
            key: 'gamesPending',
            labelKey: 'admin.dashboard.metrics.games_pending',
            tone: (v) => (v > 0 ? 'warning' : 'default'),
            hintKey: 'admin.dashboard.metrics.games_pending_hint',
            action: (
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-[11px]"
                >
                    <Link
                        href={
                            gamesRoutes.index({
                                query: { status: 'pending_review' },
                            }).url
                        }
                    >
                        {t('admin.dashboard.metrics.review_cta')}
                    </Link>
                </Button>
            ),
        },
        {
            key: 'gamesPublished',
            labelKey: 'admin.dashboard.metrics.games_published',
            tone: () => 'success',
        },
        {
            key: 'appsActive',
            labelKey: 'admin.dashboard.metrics.apps_active',
            tone: () => 'primary',
        },
        {
            key: 'appsSuspended',
            labelKey: 'admin.dashboard.metrics.apps_suspended',
            tone: (v) => (v > 0 ? 'danger' : 'default'),
            action: (
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-[11px]"
                >
                    <Link
                        href={
                            appsRoutes.index({ query: { status: 'suspended' } })
                                .url
                        }
                    >
                        {t('admin.dashboard.metrics.review_cta')}
                    </Link>
                </Button>
            ),
        },
        {
            key: 'developersClaimed',
            labelKey: 'admin.dashboard.metrics.developers_claimed',
            tone: () => 'default',
        },
        {
            key: 'developersManual',
            labelKey: 'admin.dashboard.metrics.developers_manual',
            tone: () => 'default',
        },
        {
            key: 'categories',
            labelKey: 'admin.dashboard.metrics.categories',
            tone: () => 'default',
        },
        {
            key: 'admins',
            labelKey: 'admin.dashboard.metrics.admins',
            tone: () => 'default',
        },
    ];

    return (
        <>
            <Head title={t('admin.dashboard.title')} />

            <div className="space-y-8">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">
                            {t('admin.dashboard.title')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('admin.dashboard.description')}
                        </p>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                        <Link href={auditRoutes.index().url} prefetch>
                            <History className="size-4" aria-hidden />
                            {t('admin.dashboard.view_audit')}
                        </Link>
                    </Button>
                </header>

                <MetricGrid label={t('admin.dashboard.metrics_heading')}>
                    {specs.map((spec) => {
                        const metric = metrics[spec.key];

                        return (
                            <MetricCard
                                key={spec.key}
                                label={t(spec.labelKey)}
                                value={metric.value}
                                tone={spec.tone(metric.value)}
                                hint={
                                    spec.hintKey && metric.value > 0
                                        ? t(spec.hintKey)
                                        : undefined
                                }
                                action={
                                    metric.value > 0 ? spec.action : undefined
                                }
                            />
                        );
                    })}
                </MetricGrid>

                <section
                    aria-labelledby="admin-activity-title"
                    className="rounded-surface border bg-card shadow-surface"
                >
                    <header className="flex items-center justify-between gap-3 border-b px-5 py-3 md:px-6">
                        <h2
                            id="admin-activity-title"
                            className="font-bold tracking-tight"
                        >
                            {t('admin.dashboard.activity.title')}
                        </h2>
                        <Button asChild variant="ghost" size="sm">
                            <Link href={auditRoutes.index().url} prefetch>
                                {t('admin.dashboard.activity.view_all')}
                            </Link>
                        </Button>
                    </header>

                    {recentActivity.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                            <CheckCircle2
                                className="size-8 text-muted-foreground"
                                aria-hidden
                            />
                            <p className="text-sm text-muted-foreground">
                                {t('admin.dashboard.activity.empty')}
                            </p>
                        </div>
                    ) : (
                        <ol className="divide-y">
                            {recentActivity.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex items-start gap-3 px-5 py-3 md:px-6"
                                >
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className="text-sm">
                                            <span className="font-medium">
                                                {entry.admin?.name ??
                                                    t(
                                                        'admin.dashboard.activity.system',
                                                    )}
                                            </span>{' '}
                                            <span className="text-muted-foreground">
                                                {t(
                                                    'admin.dashboard.activity.performed',
                                                )}
                                            </span>{' '}
                                            <code className="rounded-xs border bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">
                                                {entry.action}
                                            </code>
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {shortMorph(entry.auditable_type) ??
                                                t(
                                                    'admin.dashboard.activity.unknown_target',
                                                )}
                                            {entry.auditable_id && (
                                                <> · #{entry.auditable_id}</>
                                            )}{' '}
                                            ·{' '}
                                            {formatTimestamp(
                                                entry.created_at,
                                                locale,
                                            )}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </div>
        </>
    );
}

AdminDashboard.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;
