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
