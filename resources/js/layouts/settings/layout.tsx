import { Link, usePage } from '@inertiajs/react';
import { KeyRound, Lock, Palette, Plug, ShieldCheck, User } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { index as connectedAppsIndex } from '@/routes/connected-apps';
import { edit as editPrivacy } from '@/routes/privacy';
import { edit } from '@/routes/profile';
import { show } from '@/routes/two-factor';
import { edit as editPassword } from '@/routes/user-password';
import type { NavItem, Auth } from '@/types';

const getSidebarNavItems = (
    user: Auth['user'],
    t: (key: string) => string,
): NavItem[] => {
    const items: NavItem[] = [
        { title: t('nav.profile'), href: edit(), icon: User },
    ];

    if (user.has_password) {
        items.push({
            title: t('nav.password'),
            href: editPassword(),
            icon: KeyRound,
        });
    }

    items.push(
        { title: t('nav.two_factor'), href: show(), icon: ShieldCheck },
        { title: t('nav.appearance'), href: editAppearance(), icon: Palette },
        {
            title: t('nav.connected_apps'),
            href: connectedAppsIndex(),
            icon: Plug,
        },
        { title: t('nav.privacy'), href: editPrivacy(), icon: Lock },
    );

    return items;
};

/**
 * Ajustes de la cuenta: menú con iconos a la izquierda (la sección actual,
 * como una tecla levantada con su luz) y el contenido a la derecha. En móvil
 * el menú pasa a una fila desplazable.
 */
export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const auth = usePage().props.auth as Auth;
    const { t } = useTranslation();
    const sidebarNavItems = getSidebarNavItems(auth.user, t);

    // When server-side rendering, we only render the layout on the client...
    if (typeof window === 'undefined') {
        return null;
    }

    return (
        <div className="py-2">
            <Heading
                title={t('nav.settings')}
                description={t('profile.settings.desc')}
            />

            <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
                <aside className="w-full lg:w-56 lg:shrink-0">
                    <nav
                        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:rounded-surface lg:border lg:bg-surface-1 lg:p-2 lg:shadow-surface"
                        aria-label={t('nav.settings')}
                    >
                        {sidebarNavItems.map((item, index) => {
                            const active = isCurrentOrParentUrl(item.href);

                            return (
                                <Link
                                    key={`${toUrl(item.href)}-${index}`}
                                    href={item.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'flex shrink-0 items-center gap-2.5 rounded-control border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
                                        active
                                            ? 'border-border-strong bg-key-light text-foreground shadow-[0_2px_0_0_var(--key-light-edge)]'
                                            : 'border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                                    )}
                                >
                                    {item.icon && (
                                        <item.icon
                                            className="size-4 shrink-0"
                                            aria-hidden
                                        />
                                    )}
                                    {item.title}
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'ml-auto hidden size-1.5 rounded-[2px] lg:block',
                                            active
                                                ? 'bg-signal-edge'
                                                : 'bg-transparent',
                                        )}
                                    />
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                <div className="min-w-0 flex-1 md:max-w-2xl">
                    <section className="max-w-xl space-y-12">
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
