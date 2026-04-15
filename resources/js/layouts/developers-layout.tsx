import { Link } from '@inertiajs/react';
import { BookOpen, LayoutGrid, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { cn } from '@/lib/utils';
import { dashboard, docs, landing } from '@/routes/developers';
import type { AppLayoutProps, BreadcrumbItem } from '@/types';

type DevelopersLayoutProps = AppLayoutProps & {
    /**
     * Muestra la sub-navegación (pestañas) propia del dashboard.
     * La landing y el visor de docs públicos usan `false` para
     * presentarse limpios sin repetir enlaces del header principal.
     */
    showSubnav?: boolean;
};

type SubnavItem = {
    key: 'overview' | 'docs' | 'landing';
    labelKey: string;
    href: ReturnType<typeof dashboard> | ReturnType<typeof landing>;
    icon: typeof LayoutGrid;
};

/**
 * Layout persistente (patrón Inertia v2) del Developer Portal.
 *
 * - Envuelve `PortalLayout` para heredar header, footer y skip-link.
 * - Añade un sub-header con pestañas en páginas autenticadas del dashboard
 *   para que `/developers/dashboard/*` no remonte entre transiciones.
 * - En la landing y el visor de docs se oculta el sub-header (`showSubnav=false`).
 */
export default function DevelopersLayout({
    children,
    breadcrumbs,
    showSubnav = true,
}: DevelopersLayoutProps) {
    const { t } = useTranslation();
    const { isCurrentOrParentUrl } = useCurrentUrl();

    const subnavItems: SubnavItem[] = [
        {
            key: 'overview',
            labelKey: 'developers.nav.overview',
            href: dashboard(),
            icon: LayoutGrid,
        },
        {
            key: 'docs',
            labelKey: 'developers.nav.docs',
            href: docs({ slug: 'integration-guide' }),
            icon: BookOpen,
        },
        {
            key: 'landing',
            labelKey: 'developers.nav.landing',
            href: landing(),
            icon: Sparkles,
        },
    ];

    return (
        <PortalLayout breadcrumbs={breadcrumbs as BreadcrumbItem[] | undefined}>
            {showSubnav && (
                <nav
                    aria-label={t('developers.nav.aria')}
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
            )}

            {children as ReactNode}
        </PortalLayout>
    );
}
