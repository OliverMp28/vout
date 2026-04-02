import { router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

type Props = {
    nextCursor: string | null;
    loadMoreUrl: string;
    onBeforeLoad?: () => void;
};

export function CatalogPagination({
    nextCursor,
    loadMoreUrl,
    onBeforeLoad,
}: Props) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const handleLoadMore = useCallback(() => {
        if (!nextCursor) return;

        onBeforeLoad?.();
        setLoading(true);
        router.get(
            loadMoreUrl,
            { cursor: nextCursor },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['games'],
                onFinish: () => setLoading(false),
            },
        );
    }, [nextCursor, loadMoreUrl, onBeforeLoad]);

    if (!nextCursor) return null;

    return (
        <div className="flex justify-center pt-8">
            <Button
                id="btn-catalog-load-more"
                variant="secondary"
                size="lg"
                onClick={handleLoadMore}
                disabled={loading}
                className="min-w-48"
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t('catalog.loading')}
                    </>
                ) : (
                    t('catalog.load_more')
                )}
            </Button>
        </div>
    );
}
