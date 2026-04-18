import { Head, Link, router } from '@inertiajs/react';
import {
    BadgeCheck,
    Code2,
    ExternalLink,
    Plus,
    Search,
    UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type { AdminDeveloperFilters, AdminDeveloperListItem } from '@/types';

const { developers: devRoutes } = admin;

type PaginatedDevelopers = {
    data: AdminDeveloperListItem[];
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
    developers: PaginatedDevelopers;
    filters: AdminDeveloperFilters;
};

export default function AdminDevelopersIndex({ developers, filters }: Props) {
    const { t } = useTranslation();

    const pushFilters = (next: Partial<AdminDeveloperFilters>): void => {
        router.get(
            devRoutes.index().url,
            {
                search: filters.search || undefined,
                claimed: filters.claimed || undefined,
                ...next,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearch = (value: string): void => {
        pushFilters({ search: value || undefined });
    };

    const activeClaimed = filters.claimed ?? 'all';

    return (
        <>
            <Head title={t('admin.developers.index.title')} />

            <div className="space-y-6">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('admin.developers.index.title')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('admin.developers.index.description')}
                        </p>
                    </div>
                    <Button asChild size="sm" className="w-fit gap-2">
                        <Link href={devRoutes.create().url}>
                            <Plus className="size-4" aria-hidden />
                            {t('admin.developers.index.create')}
                        </Link>
                    </Button>
                </header>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder={t(
                                'admin.developers.index.search_placeholder',
                            )}
                            defaultValue={filters.search ?? ''}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <Tabs
                        value={activeClaimed}
                        onValueChange={(value) =>
                            pushFilters({
                                claimed:
                                    value === 'all'
                                        ? undefined
                                        : (value as 'claimed' | 'manual'),
                            })
                        }
                    >
                        <TabsList>
                            <TabsTrigger value="all">
                                {t('admin.developers.filters.all')}
                            </TabsTrigger>
                            <TabsTrigger value="claimed">
                                {t('admin.developers.filters.claimed')}
                            </TabsTrigger>
                            <TabsTrigger value="manual">
                                {t('admin.developers.filters.manual')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {developers.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16">
                        <Code2 className="mb-3 size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                            {t('admin.developers.index.empty')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3">
                                        {t('admin.developers.table.name')}
                                    </th>
                                    <th className="px-4 py-3">
                                        {t('admin.developers.table.ownership')}
                                    </th>
                                    <th className="hidden px-4 py-3 lg:table-cell">
                                        {t('admin.developers.table.website')}
                                    </th>
                                    <th className="px-4 py-3">
                                        {t('admin.developers.table.games')}
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {developers.data.map((dev) => (
                                    <tr
                                        key={dev.id}
                                        className="transition-colors hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium">
                                                    {dev.name}
                                                </span>
                                                <code className="font-mono text-[10px] text-muted-foreground">
                                                    {dev.slug}
                                                </code>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {dev.owner ? (
                                                <div className="flex flex-col gap-1">
                                                    <Badge
                                                        variant="default"
                                                        className="w-fit gap-1 text-[10px]"
                                                    >
                                                        <BadgeCheck
                                                            className="size-3"
                                                            aria-hidden
                                                        />
                                                        {t(
                                                            'admin.developers.badges.claimed',
                                                        )}
                                                    </Badge>
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {dev.owner.name}{' '}
                                                        <span className="font-mono text-[10px]">
                                                            ({dev.owner.email})
                                                        </span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <Badge
                                                    variant="secondary"
                                                    className="w-fit gap-1 text-[10px]"
                                                >
                                                    <UserRound
                                                        className="size-3"
                                                        aria-hidden
                                                    />
                                                    {t(
                                                        'admin.developers.badges.manual',
                                                    )}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="hidden px-4 py-3 lg:table-cell">
                                            {dev.website_url ? (
                                                <a
                                                    href={dev.website_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    <ExternalLink
                                                        className="size-3"
                                                        aria-hidden
                                                    />
                                                    <span className="max-w-32 truncate">
                                                        {dev.website_url.replace(
                                                            /^https?:\/\//,
                                                            '',
                                                        )}
                                                    </span>
                                                </a>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                {dev.games_count}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Link
                                                    href={
                                                        devRoutes.edit(dev.slug)
                                                            .url
                                                    }
                                                >
                                                    {t(
                                                        'admin.developers.table.edit',
                                                    )}
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {developers.last_page > 1 && (
                    <nav
                        className="flex items-center justify-center gap-1"
                        aria-label={t('admin.developers.index.pagination')}
                    >
                        {developers.links.map((link, i) => (
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

AdminDevelopersIndex.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);
