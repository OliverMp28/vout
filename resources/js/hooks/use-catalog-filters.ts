import { router } from '@inertiajs/react';
import { useCallback, useRef, useState } from 'react';
import { index as catalogIndex } from '@/routes/catalog';
import type { CatalogFilters } from '@/types';

type UseCatalogFiltersOptions = {
    filters: CatalogFilters;
};

export function useCatalogFilters({ filters }: UseCatalogFiltersOptions) {
    const [search, setSearchValue] = useState(filters.search);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

    const navigate = useCallback(
        (newFilters: Partial<CatalogFilters>) => {
            const merged = { ...filters, ...newFilters };

            const params: Record<string, string | string[]> = {};
            if (merged.categories.length > 0) params.categories = merged.categories;
            if (merged.search) params.search = merged.search;
            if (merged.sort !== 'popular') params.sort = merged.sort;

            router.get(catalogIndex.url(), params as Record<string, string>, {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            });
        },
        [filters],
    );

    const setSearch = useCallback(
        (value: string) => {
            setSearchValue(value);

            if (debounceRef.current) clearTimeout(debounceRef.current);

            debounceRef.current = setTimeout(() => {
                navigate({ search: value });
            }, 350);
        },
        [navigate],
    );

    const toggleCategory = useCallback(
        (slug: string) => {
            const current = filters.categories;
            const next = current.includes(slug)
                ? current.filter((s) => s !== slug)
                : [...current, slug];

            navigate({ categories: next });
        },
        [filters.categories, navigate],
    );

    const setSort = useCallback(
        (sort: CatalogFilters['sort']) => {
            navigate({ sort });
        },
        [navigate],
    );

    const clearFilters = useCallback(() => {
        setSearchValue('');
        navigate({ categories: [], search: '', sort: 'popular' });
    }, [navigate]);

    const hasActiveFilters =
        filters.categories.length > 0 ||
        filters.search !== '' ||
        filters.sort !== 'popular';

    return {
        search,
        setSearch,
        sort: filters.sort,
        setSort,
        categories: filters.categories,
        toggleCategory,
        clearFilters,
        hasActiveFilters,
    };
}
