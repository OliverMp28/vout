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

/**
 * Si hace falta una cuenta de Vout para jugar (espejo de
 * `App\Enums\AccountRequirement`):
 * - `none`     → el juego no usa la cuenta: nadie la necesita ni la comparte.
 * - `optional` → se juega sin cuenta; con ella, el juego reconoce al jugador.
 * - `required` → hay que entrar con una cuenta confirmada.
 */
export type AccountRequirement = 'none' | 'optional' | 'required';

export type Game = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    cover_image: string | null;
    embed_url: string | null;
    facial_control_support: FacialControlSupport;
    account_requirement: AccountRequirement;
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
    /** Juegos que se manejan con gestos (primero los hechos para ello). */
    gestureGames: { data: Game[] };
    /** Los últimos que se han publicado. */
    newest: { data: Game[] };
    /** Las últimas partidas de quien tiene cuenta (vacío para invitados). */
    recentGames: { data: Game[] };
    /** Categorías con juegos, con su número. */
    categories: { data: Category[] };
    canRegister: boolean;
};
