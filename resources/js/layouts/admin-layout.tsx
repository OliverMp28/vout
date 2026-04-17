import { Link, usePage } from '@inertiajs/react';
import {
    AppWindow,
    Code2,
    Gamepad2,
    LayoutDashboard,
    ScrollText,
    Tags,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { cn } from '@/lib/utils';
import admin from '@/routes/admin';
import type { AppLayoutProps, BreadcrumbItem } from '@/types';

const { dashboard, apps, games, categories, developers, audit } = admin;

type AdminLayoutProps = AppLayoutProps & {
    children: ReactNode;
};

type SubnavItem = {
    key: 'dashboard' | 'apps' | 'games' | 'categories' | 'developers' | 'audit';
    labelKey: string;
    href: string;
    icon: LucideIcon;
    match: 'exact' | 'prefix';
    /** Muestra un contador de badge junto al label si el número es positivo. */
    badge?: number;
};

type AdminSharedContext = {
    pendingGamesCount: number;
} | null;

/**
 * Layout persistente del Panel de Administración (Fase 4.2).
 *
 * Patrón idéntico a DevelopersLayout: envuelve PortalLayout y añade una
 * sub-nav con pestañas. `Dashboard` se resuelve con `exact` para no
 * disputar activación con el resto de rutas prefijadas por `/admin/`.
 * El contador de pendientes se recibe vía prop compartida `admin` desde
 * HandleInertiaRequests — sólo se popula en rutas `admin.*`.
 */
export default function AdminLayout({ children, breadcrumbs }: AdminLayoutProps) {
    const { t } = useTranslation();
    const { isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();
    const adminShared = (usePage().props.admin ?? null) as AdminSharedContext;
    const pendingGames = adminShared?.pendingGamesCount ?? 0;

    const subnavItems: SubnavItem[] = [
        {
            key: 'dashboard',
            labelKey: 'admin.nav.dashboard',
            href: dashboard().url,
            icon: LayoutDashboard,
            match: 'exact',
        },
        {
            key: 'games',
            labelKey: 'admin.nav.games',
            href: games.index().url,
            icon: Gamepad2,
            match: 'prefix',
            badge: pendingGames,
        },
        {
            key: 'apps',
            labelKey: 'admin.nav.apps',
            href: apps.index().url,
            icon: AppWindow,
            match: 'prefix',
        },
        {
            key: 'categories',
            labelKey: 'admin.nav.categories',
            href: categories.index().url,
            icon: Tags,
            match: 'prefix',
        },
        {
            key: 'developers',
            labelKey: 'admin.nav.developers',
            href: developers.index().url,
            icon: Code2,
            match: 'prefix',
        },
        {
            key: 'audit',
            labelKey: 'admin.nav.audit',
            href: audit.index().url,
            icon: ScrollText,
            match: 'prefix',
        },
    ];

    return (
        <PortalLayout breadcrumbs={breadcrumbs as BreadcrumbItem[] | undefined}>
            <nav
                aria-label={t('admin.nav.aria')}
                className="mb-8 flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card/80 p-1"
            >
                {subnavItems.map((item) => {
                    const Icon = item.icon;
                    const active =
                        item.match === 'exact'
                            ? isCurrentUrl(item.href)
                            : isCurrentOrParentUrl(item.href);
                    const showBadge = (item.badge ?? 0) > 0;

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            prefetch
                            className={cn(
                                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                active
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                            aria-current={active ? 'page' : undefined}
                        >
                            <Icon className="size-4" aria-hidden />
                            {t(item.labelKey)}
                            {showBadge && (
                                <span
                                    aria-label={t(
                                        'admin.nav.pending_badge_aria',
                                        { count: String(item.badge) },
                                    )}
                                    className={cn(
                                        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                                        active
                                            ? 'bg-primary-foreground/20 text-primary-foreground'
                                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                                    )}
                                >
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {children as ReactNode}
        </PortalLayout>
    );
}
