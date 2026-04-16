import { Head, Link, router } from '@inertiajs/react';
import { Clock, Gamepad2, Search, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { GameStatusBadge } from '@/components/developers/games/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type { AdminGameFilters, AdminGameListItem } from '@/types';

const { games: gamesRoutes } = admin;

type PaginatedGames = {
    data: AdminGameListItem[];
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
    current_page: number;
    last_page: number;
    total: number;
};

type Props = {
    games: PaginatedGames;
    filters: AdminGameFilters;
    pendingCount: number;
};

export default function AdminGamesIndex({
    games,
    filters,
    pendingCount,
}: Props) {
    const { t } = useTranslation();

    const handleSearch = (value: string): void => {
        router.get(
            gamesRoutes.index().url,
            { ...filters, search: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    const handleStatusFilter = (value: string): void => {
        router.get(
            gamesRoutes.index().url,
            { ...filters, status: value === 'all' ? undefined : value },
            { preserveState: true, replace: true },
        );
    };

    const handleFeaturedFilter = (value: string): void => {
        router.get(
            gamesRoutes.index().url,
            {
                ...filters,
                featured: value === 'all' ? undefined : value,
            },
            { preserveState: true, replace: true },
        );
    };

    return (
        <>
            <Head title={t('admin.games.index.title')} />

            <div className="space-y-6">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('admin.games.index.title')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('admin.games.index.description')}
                        </p>
                    </div>
                    {pendingCount > 0 && (
                        <Badge
                            variant="default"
                            className="flex w-fit items-center gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        >
                            <Clock className="size-3" aria-hidden />
                            {t('admin.games.index.pending_badge', {
                                count: String(pendingCount),
                            })}
                        </Badge>
                    )}
                </header>

                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder={t(
                                'admin.games.index.search_placeholder',
                            )}
                            defaultValue={filters.search ?? ''}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={filters.status ?? 'all'}
                        onValueChange={handleStatusFilter}
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {t('admin.games.filter.all')}
                            </SelectItem>
                            <SelectItem value="pending_review">
                                {t('admin.games.filter.pending_review')}
                            </SelectItem>
                            <SelectItem value="published">
                                {t('admin.games.filter.published')}
                            </SelectItem>
                            <SelectItem value="rejected">
                                {t('admin.games.filter.rejected')}
                            </SelectItem>
                            <SelectItem value="draft">
                                {t('admin.games.filter.draft')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.featured ?? 'all'}
                        onValueChange={handleFeaturedFilter}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {t('admin.games.filter.featured_all')}
                            </SelectItem>
                            <SelectItem value="1">
                                {t('admin.games.filter.featured_yes')}
                            </SelectItem>
                            <SelectItem value="0">
                                {t('admin.games.filter.featured_no')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {games.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16">
                        <Gamepad2 className="mb-3 size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                            {t('admin.games.index.empty')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">
                                        {t('admin.games.table.name')}
                                    </th>
                                    <th className="hidden px-4 py-3 md:table-cell">
                                        {t('admin.games.table.submitter')}
                                    </th>
                                    <th className="px-4 py-3">
                                        {t('admin.games.table.status')}
                                    </th>
                                    <th className="hidden px-4 py-3 lg:table-cell">
                                        {t('admin.games.table.app')}
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {games.data.map((game) => (
                                    <GameRow key={game.id} game={game} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {games.last_page > 1 && (
                    <nav
                        className="flex items-center justify-center gap-1"
                        aria-label={t('admin.games.index.pagination')}
                    >
                        {games.links.map((link, i) => (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'ghost'}
                                size="sm"
                                disabled={!link.url}
                                asChild={!!link.url}
                                className="h-8 min-w-8"
                            >
                                {link.url ? (
                                    <Link
                                        href={link.url}
                                        preserveState
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ) : (
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                )}
                            </Button>
                        ))}
                    </nav>
                )}
            </div>
        </>
    );
}

AdminGamesIndex.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);

function GameRow({ game }: { game: AdminGameListItem }) {
    const { t } = useTranslation();

    return (
        <tr className="transition-colors hover:bg-muted/30">
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <Link
                        href={gamesRoutes.show(game.slug).url}
                        className="font-medium hover:underline"
                    >
                        {game.name}
                    </Link>
                    {game.is_featured && (
                        <Sparkles
                            className="size-3.5 text-amber-500"
                            aria-label={t('admin.games.badge.featured')}
                        />
                    )}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                    {game.slug}
                </p>
            </td>
            <td className="hidden px-4 py-3 md:table-cell">
                {game.submitted_by ? (
                    <div>
                        <p className="text-sm">{game.submitted_by.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {game.submitted_by.email}
                        </p>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {t('admin.games.table.seeded')}
                    </span>
                )}
            </td>
            <td className="px-4 py-3">
                <GameStatusBadge status={game.status} />
            </td>
            <td className="hidden px-4 py-3 lg:table-cell">
                {game.registered_app ? (
                    <span className="text-xs text-muted-foreground">
                        {game.registered_app.name}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {t('admin.games.table.no_app')}
                    </span>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                <Button asChild variant="ghost" size="sm">
                    <Link href={gamesRoutes.show(game.slug).url}>
                        {t('admin.games.table.view')}
                    </Link>
                </Button>
            </td>
        </tr>
    );
}
