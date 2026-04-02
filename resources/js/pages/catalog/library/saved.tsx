import { Head } from '@inertiajs/react';
import { GameEmptyState } from '@/components/catalog/game-empty-state';
import { GameGrid } from '@/components/catalog/game-grid';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { index as catalogIndex } from '@/routes/catalog';
import type { CursorPagination, Game } from '@/types';

type Props = {
    games: CursorPagination<Game>;
};

export default function LibrarySaved({ games }: Props) {
    const { t } = useTranslation();

    return (
        <PortalLayout>
            <Head title={t('library.saved.title')} />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {t('library.saved.title')}
                    </h1>
                </div>

                {games.data.length > 0 ? (
                    <GameGrid games={games.data} />
                ) : (
                    <GameEmptyState
                        title={t('library.saved.empty.title')}
                        description={t('library.saved.empty.description')}
                        actionLabel={t('library.explore')}
                        actionHref={catalogIndex.url()}
                    />
                )}
            </div>
        </PortalLayout>
    );
}
