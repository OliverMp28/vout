export type Category = {
    id: number;
    name: string;
    slug: string;
    games_count?: number;
};

export type Developer = {
    id: number;
    name: string;
    slug: string;
    bio: string | null;
    website_url: string | null;
    logo_url: string | null;
    games_count?: number;
    role?: string;
};

export type GameUserInteraction = {
    is_favorite: boolean;
    is_saved: boolean;
    play_count_user: number;
    best_score: number | null;
    last_played_at: string | null;
};

export type Game = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    cover_image: string | null;
    embed_url: string | null;
    release_date: string | null;
    play_count: number;
    is_active: boolean;
    is_featured: boolean;
    categories: Category[];
    developers: Developer[];
    user_interaction?: GameUserInteraction;
};

export type CatalogFilters = {
    categories: string[];
    search: string;
    sort: 'popular' | 'newest' | 'alphabetical';
};

export type CursorPagination<T> = {
    data: T[];
    meta: {
        path: string;
        per_page: number;
        next_cursor: string | null;
        prev_cursor: string | null;
    };
};

export type CatalogIndexProps = {
    games: CursorPagination<Game>;
    filters: CatalogFilters;
    categories: { data: Category[] };
};

export type CatalogShowProps = {
    game: { data: Game };
    userInteraction: GameUserInteraction | null;
    related: { data: Game[] };
};

export type WelcomeProps = {
    featured: { data: Game[] };
    popular: { data: Game[] };
    canRegister: boolean;
};
