import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid, Menu, Search } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import AppLogoIcon from '@/components/app-logo-icon';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
    navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
    Sheet,
    SheetContent,
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
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { BreadcrumbItem, NavItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

export function AppHeader({ breadcrumbs = [] }: Props) {
    const page = usePage();
    const { auth } = page.props;
    const getInitials = useInitials();
    const { isCurrentUrl, whenCurrentUrl } = useCurrentUrl();
    return (
        <header className="glass-card-light sticky top-0 z-50 w-full border-b border-white/10 dark:border-white/5">
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
                                Menú de navegación
                            </SheetTitle>
                            <SheetHeader className="flex justify-start border-b border-border/40 px-4 py-6 text-left">
                                <Link
                                    href="/"
                                    className="flex items-center gap-2"
                                >
                                    <AppLogoIcon className="h-8 w-8" />
                                    <span className="bg-linear-to-r from-(--vout-gradient-start) to-(--vout-gradient-end) bg-clip-text text-xl font-bold tracking-tight text-transparent">
                                        Vout
                                    </span>
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
                    href={dashboard()}
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
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>

                <div className="ml-auto flex items-center space-x-3">
                    <div className="relative flex items-center">
                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                                    >
                                        <Search className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Buscar juegos</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="relative size-10 overflow-hidden rounded-full border-2 border-primary/20 p-0 transition-colors hover:border-primary/50"
                            >
                                <Avatar className="size-full">
                                    <AvatarImage
                                        src={auth.user.avatar}
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
                </div>
            </div>
            {breadcrumbs.length > 1 && (
                <div className="flex w-full border-t border-border/30 bg-background/30 backdrop-blur-md">
                    <div className="mx-auto flex h-10 w-full items-center justify-start px-4 text-xs font-medium text-muted-foreground md:max-w-7xl md:px-6 lg:px-8">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </header>
    );
}
