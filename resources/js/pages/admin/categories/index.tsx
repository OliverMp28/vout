import { Head, Link, router } from '@inertiajs/react';
import { Plus, Search, Tags } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type { AdminCategoryFilters, AdminCategoryListItem } from '@/types';

const { categories: catRoutes } = admin;

type PaginatedCategories = {
    data: AdminCategoryListItem[];
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
    categories: PaginatedCategories;
    filters: AdminCategoryFilters;
};

export default function AdminCategoriesIndex({ categories, filters }: Props) {
    const { t } = useTranslation();

    const handleSearch = (value: string): void => {
        router.get(
            catRoutes.index().url,
            { ...filters, search: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    return (
        <>
            <Head title={t('admin.categories.index.title')} />

            <div className="space-y-6">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('admin.categories.index.title')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('admin.categories.index.description')}
                        </p>
                    </div>
                    <Button asChild size="sm" className="w-fit gap-2">
                        <Link href={catRoutes.create().url}>
                            <Plus className="size-4" aria-hidden />
                            {t('admin.categories.index.create')}
                        </Link>
                    </Button>
                </header>

                <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder={t('admin.categories.index.search_placeholder')}
                        defaultValue={filters.search ?? ''}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {categories.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16">
                        <Tags className="mb-3 size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                            {t('admin.categories.index.empty')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">
                                        {t('admin.categories.table.name')}
                                    </th>
                                    <th className="hidden px-4 py-3 md:table-cell">
                                        {t('admin.categories.table.slug')}
                                    </th>
                                    <th className="px-4 py-3">
                                        {t('admin.categories.table.games')}
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {categories.data.map((category) => (
                                    <tr
                                        key={category.id}
                                        className="transition-colors hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            {category.name}
                                        </td>
                                        <td className="hidden px-4 py-3 md:table-cell">
                                            <code className="font-mono text-xs text-muted-foreground">
                                                {category.slug}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                {category.games_count}
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
                                                        catRoutes.edit(
                                                            category.slug,
                                                        ).url
                                                    }
                                                >
                                                    {t(
                                                        'admin.categories.table.edit',
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

                {categories.last_page > 1 && (
                    <nav
                        className="flex items-center justify-center gap-1"
                        aria-label={t('admin.categories.index.pagination')}
                    >
                        {categories.links.map((link, i) => (
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

AdminCategoriesIndex.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);
