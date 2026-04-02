import { GameCard } from '@/components/catalog/game-card';
import { GameCardSkeleton } from '@/components/catalog/game-card-skeleton';
import type { Game } from '@/types';

type Props = {
    games: Game[];
    loading?: boolean;
};

export function GameGrid({ games, loading }: Props) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <GameCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {games.map((game) => (
                <GameCard key={game.id} game={game} />
            ))}
        </div>
    );
}
