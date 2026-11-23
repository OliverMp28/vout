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

/**
 * Si el juego admite el control facial (lo declara el desarrollador):
 * - `none`       → no recibe los controles de Vout.
 * - `compatible` → recibe las teclas y los clics de Vout.
 * - `designed`   → además está pensado para jugarse con la cara.
 */
export type FacialControlSupport = 'none' | 'compatible' | 'designed';

export type Game = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    cover_image: string | null;
    embed_url: string | null;
    facial_control_support: FacialControlSupport;
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
    /** Solo juegos que se pueden jugar con la cara. */
    face: boolean;
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
