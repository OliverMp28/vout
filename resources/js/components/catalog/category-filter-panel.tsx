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
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
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
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all duration-200',
                                isActive
                                    ? 'border-primary/50 bg-primary/10 text-primary'
                                    : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
                            )}
                        >
                            {category.name}
                            {category.games_count !== undefined && (
                                <span
                                    className={cn(
                                        'text-[10px]',
                                        isActive
                                            ? 'text-primary/70'
                                            : 'text-muted-foreground/60',
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
                    <Skeleton key={i} className="h-7 w-20" />
                ))}
            </div>
        </div>
    );
}
