import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

type Props = {
    categories: Category[];
    selected: string[];
    onToggle: (slug: string) => void;
};

export function CategoryFilterPanel({ categories, selected, onToggle }: Props) {
    const { t } = useTranslation();

    return (
        <div className="space-y-2">
            <h3 className="font-pixel-label text-base leading-none text-muted-foreground">
                {t('catalog.filter.categories')}
            </h3>
            <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                    const isActive = selected.includes(category.slug);
                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => onToggle(category.slug)}
                            aria-pressed={isActive}
                            className={cn(
                                'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border px-3 text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color] active:translate-y-[2px] active:shadow-none',
                                isActive
                                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_2px_0_0_var(--key-edge)]'
                                    : 'border-border bg-surface-1 text-foreground shadow-[0_2px_0_0_var(--border)] hover:border-border-strong',
                            )}
                        >
                            {category.name}
                            {category.games_count !== undefined && (
                                <span
                                    className={cn(
                                        'font-mono text-xs font-normal',
                                        isActive
                                            ? 'opacity-75'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {category.games_count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function CategoryFilterSkeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24" />
                ))}
            </div>
        </div>
    );
}
