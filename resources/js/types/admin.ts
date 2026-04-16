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
