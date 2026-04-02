import { Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

type Props = {
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    onClear?: () => void;
};

export function GameEmptyState({
    title,
    description,
    actionLabel,
    actionHref,
    onClear,
}: Props) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Search className="size-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
            {onClear && (
                <Button variant="secondary" onClick={onClear}>
                    {t('catalog.empty.clear')}
                </Button>
            )}
            {actionLabel && actionHref && (
                <Button asChild variant="secondary">
                    <Link href={actionHref}>{actionLabel}</Link>
                </Button>
            )}
        </div>
    );
}
