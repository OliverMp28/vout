import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    Boxes,
    Lock,
    Plus,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { cn } from '@/lib/utils';
import developers from '@/routes/developers';
import type {
    DevelopersDashboardIndexProps,
    RegisteredAppResource,
} from '@/types';

const { apps: appsRoutes } = developers;

/**
 * Listado del dashboard — "Mis aplicaciones".
 *
 * Render server-side: la colección viene por prop `apps`. Empty state
 * dedicado con CTA al formulario de creación. Cada tarjeta abre la
 * vista de detalle con prefetch para transición instantánea.
 */
export default function DevelopersDashboardIndex({
    apps,
}: DevelopersDashboardIndexProps) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('developers.dashboard.index.title')} />

            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            {t('developers.dashboard.index.heading')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('developers.dashboard.index.subheading')}
                        </p>
                    </div>

                    {apps.length > 0 && (
                        <Button asChild className="gap-2 self-start">
                            <Link href={appsRoutes.create().url} prefetch>
                                <Plus className="size-4" aria-hidden />
                                {t('developers.dashboard.index.create_cta')}
                            </Link>
                        </Button>
                    )}
                </header>

                {apps.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {apps.map((app) => (
                            <li key={app.id}>
                                <AppCard app={app} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

DevelopersDashboardIndex.layout = (page: ReactNode) => (
    <DevelopersLayout>{page}</DevelopersLayout>
);

function EmptyState() {
    const { t } = useTranslation();

    return (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Boxes className="size-7" aria-hidden />
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
                {t('developers.dashboard.index.empty.title')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
                {t('developers.dashboard.index.empty.description')}
            </p>
            <Button asChild className="mt-6 gap-2">
                <Link href={appsRoutes.create().url} prefetch>
                    <Plus className="size-4" aria-hidden />
                    {t('developers.dashboard.index.empty.cta')}
                </Link>
            </Button>
        </div>
    );
}

type AppCardProps = {
    app: RegisteredAppResource;
};

function AppCard({ app }: AppCardProps) {
    const { t } = useTranslation();

    return (
        <Link
            href={appsRoutes.show(app.slug).url}
            prefetch
            className={cn(
                'group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm',
                'transition-[box-shadow,background-color] duration-300 ease-out',
                'hover:bg-accent/30 hover:shadow-md',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                    <h3 className="truncate text-base font-semibold tracking-tight">
                        {app.name}
                    </h3>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                        {app.slug}
                    </p>
                </div>
                <StatusBadge isActive={app.is_active} />
            </div>

            <p
                className="truncate text-xs text-muted-foreground"
                title={app.app_url}
            >
                {app.app_url}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-1.5">
                    {app.requires_auth ? (
                        <ProfileBadge
                            icon={ShieldCheck}
                            label={t('developers.dashboard.index.profile.idp')}
                            tone="primary"
                        />
                    ) : (
                        <ProfileBadge
                            icon={Sparkles}
                            label={t(
                                'developers.dashboard.index.profile.client_only',
                            )}
                            tone="muted"
                        />
                    )}
                    {app.is_first_party && (
                        <ProfileBadge
                            icon={Lock}
                            label={t(
                                'developers.dashboard.index.profile.first_party',
                            )}
                            tone="muted"
                        />
                    )}
                </div>
                <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden
                />
            </div>
        </Link>
    );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
    const { t } = useTranslation();
    return (
        <Badge
            variant={isActive ? 'default' : 'secondary'}
            className={cn(
                'shrink-0 text-[10px] font-semibold tracking-wider uppercase',
                isActive
                    ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            {isActive
                ? t('developers.dashboard.index.status.active')
                : t('developers.dashboard.index.status.paused')}
        </Badge>
    );
}

type ProfileBadgeProps = {
    icon: typeof ShieldCheck;
    label: string;
    tone: 'primary' | 'muted';
};

function ProfileBadge({ icon: Icon, label, tone }: ProfileBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase',
                tone === 'primary'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            <Icon className="size-3" aria-hidden />
            {label}
        </span>
    );
}
