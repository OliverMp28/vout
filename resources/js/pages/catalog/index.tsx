import { Head } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import { CatalogPagination } from '@/components/catalog/catalog-pagination';
import { CatalogToolbar } from '@/components/catalog/catalog-toolbar';
import { CategoryFilterPanel } from '@/components/catalog/category-filter-panel';
import { GameEmptyState } from '@/components/catalog/game-empty-state';
import { GameGrid } from '@/components/catalog/game-grid';
import { useCatalogFilters } from '@/hooks/use-catalog-filters';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { index as catalogIndex } from '@/routes/catalog';
import type { CatalogIndexProps, Game } from '@/types';

export default function CatalogIndex({
    games,
    filters,
    categories,
}: CatalogIndexProps) {
    const { t } = useTranslation();
    const {
        search,
        setSearch,
        sort,
        setSort,
        categories: selectedCategories,
        toggleCategory,
        clearFilters,
        hasActiveFilters,
    } = useCatalogFilters({ filters });

    // Snapshot of all pages loaded before the current one.
    // Set by handleBeforeLoadMore just before the next page request fires.
    const [storedGames, setStoredGames] = useState<Game[]>([]);

    // prev_cursor === null means the server sent the first page of a fresh
    // result set (initial load or filter change) — discard any stored pages.
    const isFirstPage = games.meta.prev_cursor === null;

    const accumulatedGames: Game[] = isFirstPage
        ? games.data
        : (() => {
              const existingIds = new Set(storedGames.map((g) => g.id));
              return [
                  ...storedGames,
                  ...games.data.filter((g) => !existingIds.has(g.id)),
              ];
          })();

    const handleBeforeLoadMore = useCallback(() => {
        setStoredGames(accumulatedGames);
    }, [accumulatedGames]);

    return (
        <PortalLayout>
            <Head title={t('catalog.title')} />

            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-semibold">
                        {t('catalog.title')}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t('catalog.description')}
                    </p>
                </div>

                {/* Filters */}
                <CategoryFilterPanel
                    categories={categories.data}
                    selected={selectedCategories}
                    onToggle={toggleCategory}
                />

                {/* Toolbar */}
                <CatalogToolbar
                    search={search}
                    onSearchChange={setSearch}
                    sort={sort}
                    onSortChange={setSort}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearFilters}
                />

                {/* Results */}
                {accumulatedGames.length > 0 ? (
                    <>
                        <GameGrid games={accumulatedGames} />
                        <CatalogPagination
                            nextCursor={games.meta.next_cursor}
                            loadMoreUrl={catalogIndex.url()}
                            onBeforeLoad={handleBeforeLoadMore}
                        />
                    </>
                ) : (
                    <GameEmptyState
                        title={t('catalog.empty.title')}
                        description={t('catalog.empty.description')}
                        onClear={hasActiveFilters ? clearFilters : undefined}
                    />
                )}
            </div>
        </PortalLayout>
    );
}
