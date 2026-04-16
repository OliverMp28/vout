import { Head, Link, router } from '@inertiajs/react';
import { AppWindow, Crown, Search, ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { cn } from '@/lib/utils';
import admin from '@/routes/admin';
import type { AdminAppFilters, AdminAppListItem } from '@/types';

const { apps: appsRoutes } = admin;

type PaginatedApps = {
    data: AdminAppListItem[];
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
    apps: PaginatedApps;
    filters: AdminAppFilters;
};

export default function AdminAppsIndex({ apps, filters }: Props) {
    const { t } = useTranslation();

    const handleSearch = (value: string): void => {
        router.get(
            appsRoutes.index().url,
            { ...filters, search: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    const handleStatusFilter = (value: string): void => {
        router.get(
            appsRoutes.index().url,
            { ...filters, status: value === 'all' ? undefined : value },
            { preserveState: true, replace: true },
        );
    };

    return (
        <>
            <Head title={t('admin.apps.index.title')} />

            <div className="space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t('admin.apps.index.title')}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t('admin.apps.index.description')}
                    </p>
                </header>

                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder={t('admin.apps.index.search_placeholder')}
                            defaultValue={filters.search ?? ''}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={filters.status ?? 'all'}
                        onValueChange={handleStatusFilter}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {t('admin.apps.filter.all')}
                            </SelectItem>
                            <SelectItem value="active">
                                {t('admin.apps.filter.active')}
                            </SelectItem>
                            <SelectItem value="paused">
                                {t('admin.apps.filter.paused')}
                            </SelectItem>
                            <SelectItem value="suspended">
                                {t('admin.apps.filter.suspended')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {apps.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16">
                        <AppWindow className="mb-3 size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                            {t('admin.apps.index.empty')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">
                                        {t('admin.apps.table.name')}
                                    </th>
                                    <th className="hidden px-4 py-3 md:table-cell">
                                        {t('admin.apps.table.owner')}
                                    </th>
                                    <th className="px-4 py-3">
                                        {t('admin.apps.table.status')}
                                    </th>
                                    <th className="hidden px-4 py-3 lg:table-cell">
                                        {t('admin.apps.table.auth')}
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {apps.data.map((app) => (
                                    <AppRow key={app.id} app={app} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {apps.last_page > 1 && (
                    <nav
                        className="flex items-center justify-center gap-1"
                        aria-label={t('admin.apps.index.pagination')}
                    >
                        {apps.links.map((link, i) => (
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

AdminAppsIndex.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);

function AppRow({ app }: { app: AdminAppListItem }) {
    const { t } = useTranslation();

    const statusVariant = app.suspended_at
        ? 'destructive'
        : app.is_active
          ? 'default'
          : 'secondary';

    const statusLabel = app.suspended_at
        ? t('admin.apps.status.suspended')
        : app.is_active
          ? t('admin.apps.status.active')
          : t('admin.apps.status.paused');

    return (
        <tr className="transition-colors hover:bg-muted/30">
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <Link
                        href={appsRoutes.show(app.slug).url}
                        className="font-medium hover:underline"
                    >
                        {app.name}
                    </Link>
                    {app.is_first_party && (
                        <Crown
                            className="size-3.5 text-amber-500"
                            aria-label={t('admin.apps.badge.first_party')}
                        />
                    )}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                    {app.app_url}
                </p>
            </td>
            <td className="hidden px-4 py-3 md:table-cell">
                {app.user ? (
                    <div>
                        <p className="text-sm">{app.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {app.user.email}
                        </p>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {t('admin.apps.table.no_owner')}
                    </span>
                )}
            </td>
            <td className="px-4 py-3">
                <Badge
                    variant={statusVariant}
                    className={cn(
                        'text-[10px]',
                        statusVariant === 'default' &&
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    )}
                >
                    {app.suspended_at && (
                        <ShieldOff className="mr-1 size-3" aria-hidden />
                    )}
                    {statusLabel}
                </Badge>
            </td>
            <td className="hidden px-4 py-3 lg:table-cell">
                <span className="text-xs text-muted-foreground">
                    {app.requires_auth
                        ? t('admin.apps.table.with_idp')
                        : t('admin.apps.table.client_only')}
                </span>
            </td>
            <td className="px-4 py-3 text-right">
                <Button asChild variant="ghost" size="sm">
                    <Link href={appsRoutes.show(app.slug).url}>
                        {t('admin.apps.table.view')}
                    </Link>
                </Button>
            </td>
        </tr>
    );
}
