/**
 * Tipos del Panel de Administración (Fase 4.2).
 */

// ── Admin: Apps ─────────────────────────────────────────────────────────

export type AdminAppOwner = {
    id: number;
    name: string;
    email: string;
    username: string;
};

export type AdminAppListItem = {
    id: number;
    name: string;
    slug: string;
    app_url: string;
    allowed_origins: string[];
    is_active: boolean;
    is_first_party: boolean;
    requires_auth: boolean;
    oauth_client_id: string | null;
    suspended_at: string | null;
    suspension_reason: string | null;
    created_at: string;
    updated_at: string;
    user: AdminAppOwner | null;
};

export type AdminAppDetail = {
    id: number;
    name: string;
    slug: string;
    app_url: string;
    allowed_origins: string[];
    is_active: boolean;
    is_first_party: boolean;
    requires_auth: boolean;
    oauth_client_id: string | null;
    suspended_at: string | null;
    suspension_reason: string | null;
    effective_status: 'active' | 'paused' | 'suspended';
    owner: AdminAppOwner | null;
    created_at: string;
    updated_at: string;
};

export type AdminAppClient = {
    id: string;
    revoked: boolean;
    confidential: boolean;
};

export type AdminAppFilters = {
    status?: string;
    first_party?: string;
    search?: string;
};

// ── Admin: Games ───────────────────────────────────────────────────────

export type GameStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

export type AdminGameSubmitter = {
    id: number;
    name: string;
    email: string;
    username: string;
};

export type AdminGameApp = {
    id: number;
    name: string;
    slug: string;
    allowed_origins: string[];
};

export type AdminGameCategory = {
    id: number;
    name: string;
    slug: string;
};

export type AdminGameListItem = {
    id: number;
    name: string;
    slug: string;
    cover_image: string | null;
    embed_url: string | null;
    status: GameStatus;
    is_active: boolean;
    is_featured: boolean;
    play_count: number;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
    submitted_by: AdminGameSubmitter | null;
    registered_app: AdminGameApp | null;
    categories: AdminGameCategory[];
};

export type AdminGameDetail = {
    id: number;
    name: string;
    slug: string;
    description: string;
    cover_image: string | null;
    embed_url: string | null;
    repo_url: string | null;
    release_date: string | null;
    status: GameStatus;
    is_active: boolean;
    is_featured: boolean;
    play_count: number;
    rejection_reason: string | null;
    created_at: string | null;
    updated_at: string | null;
    submitter: AdminGameSubmitter | null;
    registered_app: AdminGameApp | null;
    categories: AdminGameCategory[];
    developers: AdminGameCategory[];
    category_ids: number[];
    developer_ids: number[];
};

export type AdminGameFilters = {
    status?: string;
    featured?: string;
    search?: string;
};

// ── Admin: Categories ─────────────────────────────────────────────────

export type AdminCategoryListItem = {
    id: number;
    name: string;
    slug: string;
    games_count: number;
    created_at: string;
    updated_at: string;
};

export type AdminCategoryDetail = {
    id: number;
    name: string;
    slug: string;
    games_count: number;
    created_at: string | null;
    updated_at: string | null;
};

export type AdminCategoryFilters = {
    search?: string;
};

// ── Admin: Developers ─────────────────────────────────────────────────

/**
 * Titular reclamante de una ficha (Fase 4.2, S4.5). `null` en fichas
 * manuales curadas por el admin (estudios históricos, ficciones).
 */
export type AdminDeveloperOwner = {
    id: number;
    name: string;
    email: string;
    username: string;
};

export type AdminDeveloperListItem = {
    id: number;
    name: string;
    slug: string;
    website_url: string | null;
    bio: string | null;
    logo_url: string | null;
    games_count: number;
    created_at: string;
    updated_at: string;
    owner: AdminDeveloperOwner | null;
};

export type AdminDeveloperDetail = {
    id: number;
    name: string;
    slug: string;
    website_url: string | null;
    bio: string | null;
    logo_url: string | null;
    games_count: number;
    created_at: string | null;
    updated_at: string | null;
    owner: AdminDeveloperOwner | null;
};

/**
 * Opción del combo de reasignación — usuarios del portal que aún no han
 * reclamado ninguna ficha (restricción unique en `developers.user_id`).
 */
export type AdminDeveloperReassignUserOption = {
    id: number;
    name: string;
    email: string;
    username: string;
};

export type AdminDeveloperFilters = {
    search?: string;
    claimed?: 'all' | 'claimed' | 'manual';
};

// ── Admin: Dashboard ──────────────────────────────────────────────────

export type AdminMetricKey =
    | 'gamesPending'
    | 'gamesPublished'
    | 'appsActive'
    | 'appsSuspended'
    | 'developersClaimed'
    | 'developersManual'
    | 'categories'
    | 'admins';

export type AdminMetric = {
    value: number;
    trend: string | null;
};

export type AdminMetrics = Record<AdminMetricKey, AdminMetric>;

export type AdminActor = {
    id: number;
    name: string;
    email: string;
};

/**
 * Entrada ligera del feed lateral del dashboard — sólo campos de
 * cabecera. El detalle completo con `changes` y `remark` vive en la
 * página `/admin/audit`.
 */
export type AdminRecentActivityItem = {
    id: number;
    action: string;
    auditable_type: string | null;
    auditable_id: number | null;
    created_at: string | null;
    admin: AdminActor | null;
};

// ── Admin: Audit Log ──────────────────────────────────────────────────

export type AdminAuditAuditable = {
    type: string | null;
    id: number | null;
    label: string | null;
};

export type AdminAuditLogEntry = {
    id: number;
    action: string;
    changes: Record<string, unknown> | null;
    remark: string | null;
    created_at: string | null;
    admin: AdminActor | null;
    auditable: AdminAuditAuditable;
};

export type AdminAuditLogs = {
    data: AdminAuditLogEntry[];
    next_cursor: string | null;
    prev_cursor: string | null;
};

export type AdminAuditFilters = {
    action: string | null;
    admin_id: number | null;
    auditable_type: string | null;
    from: string | null;
    to: string | null;
};

export type AdminAuditAdminOption = {
    id: number;
    name: string;
    email: string;
};
