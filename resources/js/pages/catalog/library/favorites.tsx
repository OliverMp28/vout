import { Head } from '@inertiajs/react';
import { GameEmptyState } from '@/components/catalog/game-empty-state';
import { GameGrid } from '@/components/catalog/game-grid';
import { useMascotContext } from '@/hooks/use-mascot-context';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { index as catalogIndex } from '@/routes/catalog';
import type { CursorPagination, Game } from '@/types';

type Props = {
    games: CursorPagination<Game>;
};

export default function LibraryFavorites({ games }: Props) {
    const { t } = useTranslation();

    const count = games.data.length;
    useMascotContext([
        {
            id: 'library.favorites.empty',
            priority: 20,
            auto: true,
            when: count === 0,
            text: t('mascot.context.library.favorites_empty'),
        },
        {
            id: 'library.favorites.count',
            priority: 10,
            when: count > 0,
            text: t('mascot.context.library.favorites_count', { count }),
        },
    ]);

    return (
        <PortalLayout>
            <Head title={t('library.favorites.title')} />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {t('library.favorites.title')}
                    </h1>
                </div>

                {games.data.length > 0 ? (
                    <GameGrid games={games.data} />
                ) : (
                    <GameEmptyState
                        title={t('library.favorites.empty.title')}
                        description={t('library.favorites.empty.description')}
                        actionLabel={t('library.explore')}
                        actionHref={catalogIndex.url()}
                    />
                )}
            </div>
        </PortalLayout>
    );
}
