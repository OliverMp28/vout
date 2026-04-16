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
