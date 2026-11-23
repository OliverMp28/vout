/**
 * Cómo usa el usuario el control facial (espejo de `App\Enums\FacialControlUsage`):
 * - `off`        → no usa la cámara.
 * - `occasional` → la usa a veces.
 * - `primary`    → juega con la cámara.
 */
export type FacialControlUsage = 'off' | 'occasional' | 'primary';

export type UserSetting = {
    id: number;
    user_id: number;
    locale: string;
    appearance: 'light' | 'dark' | 'system';
    show_mascot: boolean;
    facial_control_usage: FacialControlUsage;
    /** La cámara se enciende sola al abrir un juego compatible (solo con `primary`). */
    camera_autostart: boolean;
    dashboard_welcome_dismissed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type User = {
    id: number;
    name: string;
    email: string;
    username: string;
    bio: string | null;
    avatar: string | null;
    vout_id: string;
    google_id: string | null;
    has_password: boolean;
    email_verified_at: string | null;
    is_admin: boolean;
    two_factor_enabled?: boolean;
    settings: UserSetting | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
