import { Link } from '@inertiajs/react';
import { AppWindow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { cn } from '@/lib/utils';
import admin from '@/routes/admin';
import type { AppLayoutProps, BreadcrumbItem } from '@/types';

const { apps } = admin;

type AdminLayoutProps = AppLayoutProps & {
    children: ReactNode;
};

type SubnavItem = {
    key: string;
    labelKey: string;
    href: ReturnType<typeof apps.index>;
    icon: LucideIcon;
    match: 'exact' | 'prefix';
};

/**
 * Layout persistente del Panel de Administración (Fase 4.2).
 *
 * Mismo patrón que DevelopersLayout: envuelve PortalLayout y añade
 * sub-navegación con pestañas. Se irán añadiendo ítems en S3–S5
 * (Games, Categories, Developers, Audit).
 */
export default function AdminLayout({ children, breadcrumbs }: AdminLayoutProps) {
    const { t } = useTranslation();
    const { isCurrentOrParentUrl } = useCurrentUrl();

    const subnavItems: SubnavItem[] = [
        {
            key: 'apps',
            labelKey: 'admin.nav.apps',
            href: apps.index(),
            icon: AppWindow,
            match: 'prefix',
        },
    ];

    return (
        <PortalLayout breadcrumbs={breadcrumbs as BreadcrumbItem[] | undefined}>
            <nav
                aria-label={t('admin.nav.aria')}
                className="mb-8 flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-sm"
            >
                {subnavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isCurrentOrParentUrl(item.href);

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
                        </Link>
                    );
                })}
            </nav>

            {children as ReactNode}
        </PortalLayout>
    );
}
