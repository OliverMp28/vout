import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { GameEmptyState } from '@/components/catalog/game-empty-state';
import { GameGrid } from '@/components/catalog/game-grid';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { index as catalogIndex } from '@/routes/catalog';
import { favorites as libraryFavorites } from '@/routes/library';
import type { BreadcrumbItem, Game } from '@/types';

type DashboardProps = {
    favorites: { data: Game[] };
    recentlyPlayed: { data: Game[] };
    featured: { data: Game[] };
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
    },
];

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

export default function Dashboard({
    favorites,
    recentlyPlayed,
    featured,
}: DashboardProps) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const user = auth.user;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('dashboard.title')} />

            <div className="space-y-10 p-6 md:p-8 lg:p-10">
                {/* Greeting */}
                <section
                    id="dashboard-greeting"
                    aria-label={t('dashboard.title')}
                    className="flex items-center gap-4"
                >
                    <Avatar className="size-12 ring-2 ring-primary/20 transition-all duration-200">
                        {user.avatar && (
                            <AvatarImage
                                src={user.avatar}
                                alt={user.name}
                            />
                        )}
                        <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                            {getInitials(user.name)}
                        </AvatarFallback>
                    </Avatar>

                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('dashboard.greeting', { name: user.name })}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </section>

                {/* Recently Played */}
                {recentlyPlayed.data.length > 0 && (
                    <section
                        id="dashboard-recently-played"
                        aria-label={t('dashboard.recent.title')}
                        className="space-y-4"
                    >
                        <h2 className="text-lg font-semibold">
                            {t('dashboard.recent.title')}
                        </h2>

                        <GameGrid games={recentlyPlayed.data} />
                    </section>
                )}

                {/* Favorites */}
                <section
                    id="dashboard-favorites"
                    aria-label={t('dashboard.favorites.title')}
                    className="space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">
                            {t('dashboard.favorites.title')}
                        </h2>

                        {favorites.data.length > 0 && (
                            <Link
                                id="dashboard-favorites-view-all"
                                href={libraryFavorites.url()}
                                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                            >
                                {t('welcome.view_all')}
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                        )}
                    </div>

                    {favorites.data.length > 0 ? (
                        <GameGrid games={favorites.data} />
                    ) : (
                        <GameEmptyState
                            title={t('dashboard.favorites.title')}
                            description={t('dashboard.favorites.empty')}
                            actionLabel={t('dashboard.explore')}
                            actionHref={catalogIndex.url()}
                        />
                    )}
                </section>

                {/* Featured Games */}
                <section
                    id="dashboard-featured"
                    aria-label={t('dashboard.featured.title')}
                    className="space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">
                            {t('dashboard.featured.title')}
                        </h2>

                        <Link
                            id="dashboard-featured-explore"
                            href={catalogIndex.url()}
                            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        >
                            {t('dashboard.explore')}
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    </div>

                    <GameGrid games={featured.data} />
                </section>
            </div>
        </AppLayout>
    );
}
