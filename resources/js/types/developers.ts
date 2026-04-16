/**
 * Tipos compartidos del Developer Portal (fase 4.1).
 *
 * Reflejan las props que los controladores de `App\Http\Controllers\Developers\*`
 * entregan a Inertia. Mantener esta forma sincronizada con:
 *   - App\Models\RegisteredApp
 *   - App\Http\Controllers\Developers\DeveloperAppController
 *   - App\Http\Controllers\Developers\DevelopersLandingController
 */

export type RegisteredAppResource = {
    readonly id: number;
    readonly slug: string;
    readonly name: string;
    readonly app_url: string;
    readonly allowed_origins: readonly string[];
    readonly is_active: boolean;
    readonly requires_auth: boolean;
    readonly is_first_party: boolean;
    readonly oauth_client_id: string | null;
    readonly suspended_at: string | null;
    readonly suspension_reason: string | null;
    readonly created_at: string;
    readonly updated_at: string;
};

/**
 * Resumen del OAuth client asociado (sin exponer jamás el secret en este tipo).
 * El secret sólo viaja como flash prop `created_client_secret` tras crear/regenerar.
 */
export type OAuthClientSummary = {
    readonly id: string;
    readonly name: string;
    readonly redirect_uris: readonly string[];
    readonly revoked: boolean;
    readonly confidential: boolean;
};

export type DeveloperGuideMeta = {
    readonly slug: string;
    readonly title_key: string;
};

/**
 * Payload que acepta `StoreDeveloperAppRequest` / `UpdateDeveloperAppRequest`.
 * Se usa como tipo genérico de `useForm`.
 */
export type AppFormData = {
    name: string;
    app_url: string;
    allowed_origins: string[];
    requires_auth: boolean;
    confidential: boolean;
    redirect_uris: string[];
};

export type DevelopersLandingProps = {
    readonly guides: readonly DeveloperGuideMeta[];
    readonly is_authenticated: boolean;
    readonly locale: string;
};

export type DevelopersDocsProps = {
    readonly slug: string;
    readonly title_key: string;
    readonly markdown: string;
    readonly locale: string;
    readonly available_locales: readonly string[];
};

export type DevelopersDashboardIndexProps = {
    readonly apps: readonly RegisteredAppResource[];
};

export type DevelopersAppShowProps = {
    readonly app: RegisteredAppResource;
    readonly client: OAuthClientSummary | null;
    readonly created_client_secret: string | null;
};

/**
 * Estado de moderación — espejo de `App\Enums\GameStatus`.
 */
export type GameStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

export type GameCategoryChip = {
    readonly id: number;
    readonly name: string;
    readonly slug: string;
};

export type GameAppChip = {
    readonly id: number;
    readonly name: string;
    readonly slug: string;
    readonly is_active?: boolean;
    readonly is_suspended?: boolean;
};

export type DeveloperGameCardResource = {
    readonly id: number;
    readonly name: string;
    readonly slug: string;
    readonly cover_image: string | null;
    readonly embed_url: string | null;
    readonly status: GameStatus;
    readonly is_active: boolean;
    readonly play_count: number;
    readonly created_at: string | null;
    readonly updated_at: string | null;
    readonly registered_app: GameAppChip | null;
    readonly categories: readonly GameCategoryChip[];
};

export type DeveloperGameDetailResource = DeveloperGameCardResource & {
    readonly description: string;
    readonly release_date: string | null;
    readonly repo_url: string | null;
    readonly rejection_reason: string | null;
    readonly is_editable: boolean;
    readonly is_deletable: boolean;
    readonly category_ids: readonly number[];
    readonly developer_ids: readonly number[];
    readonly registered_app_id: number | null;
};

export type DeveloperAppOption = {
    readonly id: number;
    readonly name: string;
    readonly slug: string;
    readonly is_active: boolean;
    readonly allowed_origins: readonly string[];
};

export type CategoryOption = {
    readonly id: number;
    readonly name: string;
    readonly slug: string;
};

export type DeveloperOption = CategoryOption;

export type GameFormData = {
    name: string;
    description: string;
    registered_app_id: number | null;
    embed_url: string;
    cover_image: string;
    release_date: string;
    repo_url: string;
    category_ids: number[];
    developer_ids: number[];
};

export type DevelopersGameIndexProps = {
    readonly games: readonly DeveloperGameCardResource[];
};

export type DevelopersGameCreateProps = {
    readonly apps: readonly DeveloperAppOption[];
    readonly categories: readonly CategoryOption[];
    readonly developers: readonly DeveloperOption[];
};

export type DevelopersGameShowProps = {
    readonly game: DeveloperGameDetailResource;
    readonly apps: readonly DeveloperAppOption[];
    readonly categories: readonly CategoryOption[];
    readonly developers: readonly DeveloperOption[];
};
