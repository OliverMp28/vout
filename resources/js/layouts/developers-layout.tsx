import { Link } from '@inertiajs/react';
import {
    BookOpen,
    Gamepad2,
    LayoutGrid,
    Sparkles,
    UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { cn } from '@/lib/utils';
import developers from '@/routes/developers';
import type { AppLayoutProps, BreadcrumbItem } from '@/types';

const { dashboard, docs, games, landing, profile } = developers;

type DevelopersLayoutProps = AppLayoutProps & {
    /**
     * Muestra la sub-navegación (pestañas) propia del dashboard.
     * La landing y el visor de docs públicos usan `false` para
     * presentarse limpios sin repetir enlaces del header principal.
     */
    showSubnav?: boolean;
};

type SubnavItem = {
    key: 'overview' | 'games' | 'profile' | 'docs' | 'landing';
    labelKey: string;
    href: ReturnType<typeof dashboard> | ReturnType<typeof landing>;
    icon: typeof LayoutGrid;
    /**
     * `exact` — sólo resalta si la URL coincide con `href` al carácter.
     * `prefix` — resalta la pestaña también para rutas hijas (p.ej. `/developers/dashboard/*`).
     *
     * Landing vive en `/developers` y es padre de todo lo demás; usar `prefix`
     * aquí haría que cualquier página del portal marque "Portal público" como
     * activa a la vez que la pestaña real.
     */
    match: 'exact' | 'prefix';
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
    const { currentUrl, isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();

    // La pestaña "Mis aplicaciones" cubre el dashboard y todo el CRUD de
    // `/developers/apps/*` (crear, detalle, edición). Sin esta extensión,
    // al entrar al detalle de una app la pestaña se apagaría y el usuario
    // perdería el anclaje visual de sección.
    const isInAppsFlow = currentUrl.startsWith('/developers/apps');
    // La pestaña de juegos cubre su listado (`/developers/dashboard/games`)
    // y todo su CRUD (create/show). El endpoint base está bajo `/dashboard`,
    // pero sin esta excepción entraría en conflicto con "Panel" al compartir
    // prefijo. Resolvemos el caso evaluando este flag antes de `overview`.
    const isInGamesFlow = currentUrl.startsWith('/developers/dashboard/games');
    // Perfil vive en `/developers/dashboard/profile`. Mismo conflicto de
    // prefijo que `games`: si no lo evaluamos antes, "Panel" se enciende.
    const isInProfileFlow = currentUrl.startsWith(
        '/developers/dashboard/profile',
    );

    const subnavItems: SubnavItem[] = [
        {
            key: 'overview',
            labelKey: 'developers.nav.overview',
            href: dashboard(),
            icon: LayoutGrid,
            match: 'prefix',
        },
        {
            key: 'games',
            labelKey: 'developers.nav.games',
            href: games.index(),
            icon: Gamepad2,
            match: 'prefix',
        },
        {
            key: 'profile',
            labelKey: 'developers.nav.profile',
            href: profile.edit(),
            icon: UserRound,
            match: 'prefix',
        },
        {
            key: 'docs',
            labelKey: 'developers.nav.docs',
            href: docs({ slug: 'integration-guide' }),
            icon: BookOpen,
            match: 'prefix',
        },
        {
            key: 'landing',
            labelKey: 'developers.nav.landing',
            href: landing(),
            icon: Sparkles,
            match: 'exact',
        },
    ];

    return (
        <PortalLayout breadcrumbs={breadcrumbs as BreadcrumbItem[] | undefined}>
            {showSubnav && (
                <nav
                    aria-label={t('developers.nav.aria')}
                    className="mb-8 flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card/80 p-1"
                >
                    {subnavItems.map((item) => {
                        const Icon = item.icon;
                        const baseActive =
                            item.match === 'exact'
                                ? isCurrentUrl(item.href)
                                : isCurrentOrParentUrl(item.href);
                        const active =
                            // Juegos y Perfil ganan prioridad sobre "Panel"
                            // cuando la URL empieza por `/developers/dashboard/{games|profile}`
                            // porque todos comparten prefijo `/developers/dashboard`.
                            item.key === 'overview'
                                ? (baseActive &&
                                      !isInGamesFlow &&
                                      !isInProfileFlow) ||
                                  isInAppsFlow
                                : item.key === 'games'
                                  ? isInGamesFlow
                                  : item.key === 'profile'
                                    ? isInProfileFlow
                                    : baseActive;

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
