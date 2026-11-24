import { Link, usePage } from '@inertiajs/react';
import { Bookmark, ChevronDown, Heart, Menu, Search } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { AppearanceSwitcher } from '@/components/appearance-switcher';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { UserMenuContent } from '@/components/user-menu-content';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard, login } from '@/routes';
import { index as catalogIndex } from '@/routes/catalog';
import {
    favorites as libraryFavorites,
    saved as librarySaved,
} from '@/routes/library';
import type { BreadcrumbItem, NavItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

/** Luz de la navegación: encendida (cian) en la sección actual. */
function NavLight({ active }: { active: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'size-1.5 shrink-0 rounded-[2px] transition-colors',
                active ? 'bg-signal-edge' : 'bg-transparent',
            )}
        />
    );
}

const navItemClass = (active: boolean) =>
    cn(
        'inline-flex h-10 items-center gap-2 rounded-control px-3 text-sm font-semibold transition-colors',
        active
            ? 'bg-surface-sunken text-foreground'
            : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
    );

/**
 * Cabecera del portal: fondo sólido (sin desenfoque), la sección actual con
 * su luz encendida, y a la derecha buscar, tema, idioma y la cuenta (o
 * "Entrar" para quien no ha iniciado sesión).
 */
export function AppHeader({ breadcrumbs = [] }: Props) {
    const page = usePage();
    const { auth } = page.props;
    const getInitials = useInitials();
    const { isCurrentUrl } = useCurrentUrl();
    const { t } = useTranslation();

    const mainNavItems: NavItem[] = [
        { title: t('nav.dashboard'), href: dashboard(), icon: null },
        { title: t('nav.catalog'), href: catalogIndex(), icon: null },
    ];

    const libraryNavItems: NavItem[] = [
        {
            title: t('library.favorites.title'),
            href: libraryFavorites(),
            icon: Heart,
        },
        {
            title: t('library.saved.title'),
            href: librarySaved(),
            icon: Bookmark,
        },
    ];

    const isLibraryActive = libraryNavItems.some((item) =>
        isCurrentUrl(item.href),
    );

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-surface-1">
            <div className="mx-auto flex h-16 items-center gap-2 px-4 md:max-w-7xl md:px-6 lg:px-8">
                {/* Menú en móvil */}
                <div className="lg:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('nav.menu')}
                            >
                                <Menu className="size-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent
                            side="left"
                            className="flex h-full w-72 flex-col items-stretch gap-0 p-0"
                        >
                            <SheetTitle className="sr-only">
                                {t('nav.menu')}
                            </SheetTitle>
                            <SheetDescription className="sr-only">
                                {t('nav.menu_description')}
                            </SheetDescription>
                            <SheetHeader className="border-b px-5 py-5 text-left">
                                <Link
                                    href="/"
                                    className="flex items-center gap-2.5"
                                >
                                    <AppLogo className="h-7" />
                                </Link>
                            </SheetHeader>
                            <nav className="flex flex-col gap-1 p-3">
                                {mainNavItems.map((item) => (
                                    <Link
                                        key={item.title}
                                        href={item.href}
                                        className={navItemClass(
                                            isCurrentUrl(item.href),
                                        )}
                                    >
                                        <NavLight
                                            active={isCurrentUrl(item.href)}
                                        />
                                        {item.title}
                                    </Link>
                                ))}
                            </nav>
                            <div className="flex flex-col gap-1 border-t p-3">
                                <p className="px-3 pt-1 pb-1.5 font-pixel-label text-base leading-none text-muted-foreground">
                                    {t('nav.library')}
                                </p>
                                {libraryNavItems.map((item) => (
                                    <Link
                                        key={item.title}
                                        href={item.href}
                                        className={navItemClass(
                                            isCurrentUrl(item.href),
                                        )}
                                    >
                                        {item.icon && (
                                            <item.icon className="size-4" />
                                        )}
                                        {item.title}
                                    </Link>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <Link
                    href="/"
                    prefetch
                    aria-label="Vout"
                    className="flex items-center gap-2.5 rounded-control"
                >
                    <AppLogo className="h-7" />
                </Link>

                {/* Navegación de escritorio */}
                <nav
                    aria-label={t('nav.menu')}
                    className="ml-6 hidden items-center gap-1 lg:flex"
                >
                    {mainNavItems.map((item) => {
                        const active = isCurrentUrl(item.href);

                        return (
                            <Link
                                key={item.title}
                                href={item.href}
                                className={navItemClass(active)}
                                aria-current={active ? 'page' : undefined}
                            >
                                <NavLight active={active} />
                                {item.title}
                            </Link>
                        );
                    })}

                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={cn(
                                navItemClass(isLibraryActive),
                                'cursor-pointer',
                            )}
                        >
                            <NavLight active={isLibraryActive} />
                            {t('nav.library')}
                            <ChevronDown className="size-3.5" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 p-1">
                            {libraryNavItems.map((item) => (
                                <DropdownMenuItem key={item.title} asChild>
                                    <Link
                                        href={item.href}
                                        prefetch
                                        className={cn(
                                            'cursor-pointer gap-3 px-3 py-2 font-semibold',
                                            isCurrentUrl(item.href) &&
                                                'bg-surface-sunken',
                                        )}
                                    >
                                        {item.icon && (
                                            <item.icon className="size-4" />
                                        )}
                                        {item.title}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </nav>

                <div className="ml-auto flex items-center gap-1">
                    <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        id="btn-header-search"
                        aria-label={t('nav.search')}
                        title={t('nav.search')}
                    >
                        <Link href={catalogIndex()}>
                            <Search className="size-5" />
                        </Link>
                    </Button>

                    <AppearanceSwitcher />

                    <LanguageSwitcher />

                    {auth?.user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="ml-1 size-10 overflow-hidden rounded-control border border-border-strong p-0"
                                    aria-label={auth.user.name}
                                >
                                    <Avatar className="size-full rounded-none">
                                        <AvatarImage
                                            src={auth.user.avatar ?? undefined}
                                            alt={auth.user.name}
                                            className="object-cover"
                                        />
                                        <AvatarFallback className="rounded-none bg-surface-sunken font-bold text-foreground">
                                            {getInitials(auth.user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-64 p-1"
                                align="end"
                            >
                                <UserMenuContent user={auth.user} />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button
                            asChild
                            variant="secondary"
                            size="sm"
                            className="ml-1"
                        >
                            <Link href={login()}>{t('nav.log_in')}</Link>
                        </Button>
                    )}
                </div>
            </div>
            {breadcrumbs.length > 1 && (
                <div className="flex w-full border-t bg-surface-1">
                    <div className="mx-auto flex h-10 w-full items-center justify-start px-4 text-xs font-medium text-muted-foreground md:max-w-7xl md:px-6 lg:px-8">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </header>
    );
}
