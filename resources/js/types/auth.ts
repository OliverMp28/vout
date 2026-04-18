export type UserSetting = {
    id: number;
    user_id: number;
    appearance: 'light' | 'dark' | 'system';
    show_mascot: boolean;
    gestures_enabled: boolean;
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
