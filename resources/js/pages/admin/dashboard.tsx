import { Head, Link } from '@inertiajs/react';
import {
    AppWindow,
    CheckCircle2,
    Code2,
    Gamepad2,
    History,
    ScrollText,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Tags,
    UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { MetricCard } from '@/components/admin/metric-card';
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
    icon: LucideIcon;
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
            icon: Sparkles,
            tone: (v) => (v > 0 ? 'warning' : 'default'),
            hintKey: 'admin.dashboard.metrics.games_pending_hint',
            action: (
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-[11px]"
                >
                    <Link href={gamesRoutes.index({ query: { status: 'pending_review' } }).url}>
                        {t('admin.dashboard.metrics.review_cta')}
                    </Link>
                </Button>
            ),
        },
        {
            key: 'gamesPublished',
            labelKey: 'admin.dashboard.metrics.games_published',
            icon: Gamepad2,
            tone: () => 'success',
        },
        {
            key: 'appsActive',
            labelKey: 'admin.dashboard.metrics.apps_active',
            icon: AppWindow,
            tone: () => 'primary',
        },
        {
            key: 'appsSuspended',
            labelKey: 'admin.dashboard.metrics.apps_suspended',
            icon: ShieldAlert,
            tone: (v) => (v > 0 ? 'danger' : 'default'),
            action: (
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-[11px]"
                >
                    <Link href={appsRoutes.index({ query: { status: 'suspended' } }).url}>
                        {t('admin.dashboard.metrics.review_cta')}
                    </Link>
                </Button>
            ),
        },
        {
            key: 'developersClaimed',
            labelKey: 'admin.dashboard.metrics.developers_claimed',
            icon: ShieldCheck,
            tone: () => 'default',
        },
        {
            key: 'developersManual',
            labelKey: 'admin.dashboard.metrics.developers_manual',
            icon: Code2,
            tone: () => 'default',
        },
        {
            key: 'categories',
            labelKey: 'admin.dashboard.metrics.categories',
            icon: Tags,
            tone: () => 'default',
        },
        {
            key: 'admins',
            labelKey: 'admin.dashboard.metrics.admins',
            icon: UserCog,
            tone: () => 'default',
        },
    ];

    return (
        <>
            <Head title={t('admin.dashboard.title')} />

            <div className="space-y-8">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('admin.dashboard.title')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('admin.dashboard.description')}
                        </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <Link href={auditRoutes.index().url} prefetch>
                            <History className="mr-2 size-4" aria-hidden />
                            {t('admin.dashboard.view_audit')}
                        </Link>
                    </Button>
                </header>

                <section
                    aria-label={t('admin.dashboard.metrics_heading')}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                    {specs.map((spec) => {
                        const metric = metrics[spec.key];

                        return (
                            <MetricCard
                                key={spec.key}
                                label={t(spec.labelKey)}
                                value={metric.value}
                                icon={spec.icon}
                                tone={spec.tone(metric.value)}
                                hint={
                                    spec.hintKey && metric.value > 0
                                        ? t(spec.hintKey)
                                        : undefined
                                }
                                action={metric.value > 0 ? spec.action : undefined}
                            />
                        );
                    })}
                </section>

                <section
                    aria-label={t('admin.dashboard.activity.title')}
                    className="rounded-2xl border border-border/60 bg-card shadow-sm"
                >
                    <header className="flex items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
                        <div className="flex items-center gap-2">
                            <ScrollText
                                className="size-4 text-muted-foreground"
                                aria-hidden
                            />
                            <h2 className="text-sm font-semibold tracking-tight">
                                {t('admin.dashboard.activity.title')}
                            </h2>
                        </div>
                        <Button asChild variant="ghost" size="sm">
                            <Link href={auditRoutes.index().url} prefetch>
                                {t('admin.dashboard.activity.view_all')}
                            </Link>
                        </Button>
                    </header>

                    {recentActivity.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                            <CheckCircle2
                                className="size-8 text-muted-foreground/40"
                                aria-hidden
                            />
                            <p className="text-sm text-muted-foreground">
                                {t('admin.dashboard.activity.empty')}
                            </p>
                        </div>
                    ) : (
                        <ol className="divide-y divide-border/60">
                            {recentActivity.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-muted/30"
                                >
                                    <span
                                        className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                                        aria-hidden
                                    >
                                        <ScrollText className="size-3.5" />
                                    </span>
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className="text-sm">
                                            <span className="font-medium">
                                                {entry.admin?.name ??
                                                    t('admin.dashboard.activity.system')}
                                            </span>{' '}
                                            <span className="text-muted-foreground">
                                                {t('admin.dashboard.activity.performed')}
                                            </span>{' '}
                                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                                                {entry.action}
                                            </code>
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {shortMorph(entry.auditable_type) ??
                                                t('admin.dashboard.activity.unknown_target')}
                                            {entry.auditable_id && (
                                                <>
                                                    {' '}·{' '}#{entry.auditable_id}
                                                </>
                                            )}
                                            {' '}·{' '}
                                            {formatTimestamp(entry.created_at, locale)}
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
