import { Link, usePage } from '@inertiajs/react';
import {
    Bookmark,
    Heart,
    LayoutGrid,
    Library,
    Menu,
    Search,
    Shapes,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { AppearanceSwitcher } from '@/components/appearance-switcher';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserMenuContent } from '@/components/user-menu-content';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as catalogIndex } from '@/routes/catalog';
import { favorites as libraryFavorites, saved as librarySaved } from '@/routes/library';
import type { BreadcrumbItem, NavItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

export function AppHeader({ breadcrumbs = [] }: Props) {
    const page = usePage();
    const { auth } = page.props;
    const getInitials = useInitials();
    const { isCurrentUrl, whenCurrentUrl } = useCurrentUrl();
    const { t } = useTranslation();

    const mainNavItems: NavItem[] = [
        {
            title: t('nav.dashboard'),
            href: dashboard(),
            icon: LayoutGrid,
        },
        {
            title: t('nav.catalog'),
            href: catalogIndex(),
            icon: Shapes,
        },
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
        <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-lg backdrop-saturate-150 supports-backdrop-filter:bg-background/65 dark:bg-background/80 dark:supports-backdrop-filter:bg-background/60">
            <div className="mx-auto flex h-16 items-center px-4 md:max-w-7xl md:px-6 lg:px-8">
                {/* Mobile Menu */}
                <div className="lg:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="mr-2 h-9 w-9 text-foreground/70 hover:text-primary"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent
                            side="left"
                            className="flex h-full w-64 flex-col items-stretch justify-between border-r border-border/40 bg-background"
                        >
                            <SheetTitle className="sr-only">
                                {t('nav.menu')}
                            </SheetTitle>
                            <SheetDescription className="sr-only">
                                {t('nav.menu_description')}
                            </SheetDescription>
                            <SheetHeader className="flex justify-start border-b border-border/40 px-4 py-6 text-left">
                                <Link
                                    href="/"
                                    className="flex items-center gap-2"
                                >
                                    <AppLogo />
                                </Link>
                            </SheetHeader>
                            <div className="mt-4 flex h-full flex-1 flex-col space-y-4 p-4">
                                <nav className="flex flex-col space-y-2">
                                    {mainNavItems.map((item) => (
                                        <Link
                                            key={item.title}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                                isCurrentUrl(item.href)
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                            )}
                                        >
                                            {item.icon && (
                                                <item.icon className="h-5 w-5" />
                                            )}
                                            <span>{item.title}</span>
                                        </Link>
                                    ))}
                                </nav>

                                <div className="space-y-2">
                                    <p className="px-3 pt-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                        {t('nav.library')}
                                    </p>
                                    <nav className="flex flex-col space-y-2">
                                        {libraryNavItems.map((item) => (
                                            <Link
                                                key={item.title}
                                                href={item.href}
                                                className={cn(
                                                    'flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                                    isCurrentUrl(item.href)
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                                )}
                                            >
                                                {item.icon && (
                                                    <item.icon className="h-5 w-5" />
                                                )}
                                                <span>{item.title}</span>
                                            </Link>
                                        ))}
                                    </nav>
                                </div>
                            </div>
                            <div className="border-t border-border/40 p-4">
                                <p className="text-center text-xs text-muted-foreground">
                                    Vout Identity Provider
                                </p>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <Link
                    href="/"
                    prefetch
                    className="group flex items-center space-x-2 transition-opacity hover:opacity-90"
                >
                    <AppLogo />
                </Link>

                {/* Desktop Navigation */}
                <div className="ml-10 hidden h-full items-center space-x-1 lg:flex">
                    <NavigationMenu className="flex h-full items-stretch">
                        <NavigationMenuList className="flex h-full items-stretch space-x-1">
                            {mainNavItems.map((item, index) => (
                                <NavigationMenuItem
                                    key={index}
                                    className="relative flex h-full items-center"
                                >
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            navigationMenuTriggerStyle(),
                                            whenCurrentUrl(
                                                item.href,
                                                'bg-primary/5 text-primary',
                                            ),
                                            'h-10 cursor-pointer bg-transparent px-4 text-sm font-medium transition-colors hover:text-primary',
                                        )}
                                    >
                                        {item.icon && (
                                            <item.icon className="mr-2 h-4.5 w-4.5 transition-transform group-hover:scale-110" />
                                        )}
                                        {item.title}
                                    </Link>
                                    {isCurrentUrl(item.href) && (
                                        <div className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary"></div>
                                    )}
                                </NavigationMenuItem>
                            ))}

                            <NavigationMenuItem className="relative flex h-full items-center">
                                <NavigationMenuTrigger
                                    onPointerMove={(e) => e.preventDefault()}
                                    onPointerLeave={(e) => e.preventDefault()}
                                    className={cn(
                                        'h-10 cursor-pointer bg-transparent px-4 text-sm font-medium transition-colors hover:text-primary',
                                        isLibraryActive &&
                                            'bg-primary/5 text-primary',
                                    )}
                                >
                                    <Library className="mr-2 h-4.5 w-4.5 transition-transform group-hover:scale-110" />
                                    {t('nav.library')}
                                </NavigationMenuTrigger>
                                <NavigationMenuContent
                                    onPointerEnter={(e) => e.preventDefault()}
                                    onPointerLeave={(e) => e.preventDefault()}
                                >
                                    <ul className="grid w-60 gap-1 p-2">
                                        {libraryNavItems.map((item) => (
                                            <li key={item.title}>
                                                <NavigationMenuLink asChild>
                                                    <Link
                                                        href={item.href}
                                                        prefetch
                                                        className={cn(
                                                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                                            isCurrentUrl(
                                                                item.href,
                                                            )
                                                                ? 'bg-primary/10 text-primary'
                                                                : 'text-foreground hover:bg-accent hover:text-foreground',
                                                        )}
                                                    >
                                                        {item.icon && (
                                                            <item.icon className="size-4" />
                                                        )}
                                                        <span>
                                                            {item.title}
                                                        </span>
                                                    </Link>
                                                </NavigationMenuLink>
                                            </li>
                                        ))}
                                    </ul>
                                </NavigationMenuContent>
                                {isLibraryActive && (
                                    <div className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary"></div>
                                )}
                            </NavigationMenuItem>
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>

                <div className="ml-auto flex items-center space-x-3">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    id="btn-header-search"
                                    aria-label={t('nav.search')}
                                    className="h-9 w-9 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                                >
                                    <Link href={catalogIndex()}>
                                        <Search className="h-5 w-5" />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('nav.search')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <AppearanceSwitcher />

                    <LanguageSwitcher />

                    {auth?.user && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="relative size-10 overflow-hidden rounded-full border-2 border-primary/20 p-0 transition-colors hover:border-primary/50"
                                >
                                    <Avatar className="size-full">
                                        <AvatarImage
                                            src={auth.user.avatar ?? undefined}
                                            alt={auth.user.name}
                                            className="object-cover"
                                        />
                                        <AvatarFallback className="bg-primary/10 font-bold text-primary">
                                            {getInitials(auth.user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="glass-card-light mt-2 w-64 border-white/20 p-1"
                                align="end"
                            >
                                <UserMenuContent user={auth.user} />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
            {breadcrumbs.length > 1 && (
                <div className="flex w-full border-t border-border/30 bg-background/70 backdrop-blur-lg backdrop-saturate-150 supports-backdrop-filter:bg-background/55">
                    <div className="mx-auto flex h-10 w-full items-center justify-start px-4 text-xs font-medium text-muted-foreground md:max-w-7xl md:px-6 lg:px-8">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </header>
    );
}
