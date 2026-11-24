import { ScanFace, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { useTranslation } from '@/hooks/use-translation';
import type { CatalogFilters } from '@/types';

type Props = {
    search: string;
    onSearchChange: (value: string) => void;
    sort: CatalogFilters['sort'];
    onSortChange: (sort: CatalogFilters['sort']) => void;
    /** Solo juegos que se pueden jugar con la cara. */
    face: boolean;
    onFaceChange: (face: boolean) => void;
    hasActiveFilters: boolean;
    onClearFilters: () => void;
};

export function CatalogToolbar({
    search,
    onSearchChange,
    sort,
    onSortChange,
    face,
    onFaceChange,
    hasActiveFilters,
    onClearFilters,
}: Props) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('catalog.search')}
                    className="pr-8 pl-9"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {/* Solo los que se manejan con gestos */}
                <Toggle
                    id="catalog-filter-face"
                    variant="outline"
                    pressed={face}
                    onPressedChange={onFaceChange}
                    className="gap-1.5 px-3"
                >
                    <ScanFace aria-hidden="true" />
                    {t('catalog.filter.face')}
                </Toggle>

                {/* Sort */}
                <Select
                    value={sort}
                    onValueChange={(v) =>
                        onSortChange(v as CatalogFilters['sort'])
                    }
                >
                    <SelectTrigger
                        className="w-36"
                        aria-label={t('catalog.sort.label')}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="popular">
                            {t('catalog.sort.popular')}
                        </SelectItem>
                        <SelectItem value="newest">
                            {t('catalog.sort.newest')}
                        </SelectItem>
                        <SelectItem value="alphabetical">
                            {t('catalog.sort.alphabetical')}
                        </SelectItem>
                    </SelectContent>
                </Select>

                {/* Clear */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearFilters}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="mr-1 size-3.5" />
                        {t('catalog.filter.clear')}
                    </Button>
                )}
            </div>
        </div>
    );
}
