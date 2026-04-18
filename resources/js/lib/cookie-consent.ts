/**
 * Vout cookie-consent state — single source of truth shared between
 * the banner, the preferences dialog and any module that writes a
 * preference cookie (theme, sidebar). Pure DOM/storage layer; the React
 * hook lives in `@/hooks/use-cookie-consent` and subscribes to changes
 * here via {@link subscribeConsent}.
 */

export const CONSENT_COOKIE_NAME = 'vout-cookie-consent';
export const CONSENT_VERSION = 1;
const CONSENT_TTL_DAYS = 365;

export type CookieConsent = {
    readonly v: number;
    readonly technical: true;
    readonly preferences: boolean;
    readonly decided_at: string;
};

const listeners = new Set<() => void>();
let cached: CookieConsent | null | undefined;

const isBrowser = (): boolean => typeof document !== 'undefined';

function readCookie(name: string): string | null {
    if (!isBrowser()) return null;
    const prefix = `${name}=`;
    const segments = document.cookie ? document.cookie.split('; ') : [];
    for (const segment of segments) {
        if (segment.startsWith(prefix)) {
            return decodeURIComponent(segment.slice(prefix.length));
        }
    }
    return null;
}

function writeCookie(name: string, value: string, days: number): void {
    if (!isBrowser()) return;
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function deleteCookie(name: string): void {
    if (!isBrowser()) return;
    document.cookie = `${name}=;path=/;max-age=0;SameSite=Lax`;
}

function notify(): void {
    cached = undefined;
    listeners.forEach((listener) => listener());
}

/**
 * Read the current decision. Returns `null` if the user has not chosen
 * yet — that's the signal the banner uses to render itself.
 */
export function readConsent(): CookieConsent | null {
    if (cached !== undefined) return cached;
    const raw = readCookie(CONSENT_COOKIE_NAME);
    if (!raw) {
        cached = null;
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as Partial<CookieConsent>;
        if (parsed.v !== CONSENT_VERSION || typeof parsed.preferences !== 'boolean') {
            cached = null;
            return null;
        }
        cached = {
            v: CONSENT_VERSION,
            technical: true,
            preferences: parsed.preferences,
            decided_at: typeof parsed.decided_at === 'string' ? parsed.decided_at : new Date().toISOString(),
        };
        return cached;
    } catch {
        cached = null;
        return null;
    }
}

/**
 * Persist the user's decision and broadcast to subscribers. When the
 * user opts out, any previously stored preference cookie is wiped so
 * the next render reflects the rejection immediately.
 */
export function writeConsent(preferences: boolean): CookieConsent {
    const consent: CookieConsent = {
        v: CONSENT_VERSION,
        technical: true,
        preferences,
        decided_at: new Date().toISOString(),
    };
    writeCookie(CONSENT_COOKIE_NAME, JSON.stringify(consent), CONSENT_TTL_DAYS);
    if (!preferences) {
        clearPreferenceStorage();
    }
    notify();
    return consent;
}

/**
 * Force-reopen the banner (used by the "Manage cookies" link). Removes
 * the decision cookie so that the banner re-appears on the next render.
 */
export function resetConsent(): void {
    deleteCookie(CONSENT_COOKIE_NAME);
    notify();
}

/**
 * Non-reactive guard for cookie writers (theme toggle, sidebar). Returns
 * `true` only when the user has explicitly opted in to preference
 * cookies. Before any decision we treat preference cookies as denied so
 * we never store anything new without consent.
 */
export function preferencesAllowed(): boolean {
    return readConsent()?.preferences === true;
}

export function subscribeConsent(callback: () => void): () => void {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
}

/**
 * Wipes the cookies + localStorage entries clasificadas como
 * "preferencia" en `docs/legal/cookies.{es,en}.md`. Para invitados es
 * sólo `appearance` (el único cookie de preferencia que puede existir
 * sin sesión); `sidebar_state` no se toca porque es estado funcional UI
 * de admin y sólo aparece cuando el usuario está autenticado.
 */
export function clearPreferenceStorage(): void {
    if (!isBrowser()) return;
    deleteCookie('appearance');
    try {
        window.localStorage.removeItem('appearance');
    } catch {
        // Ignore — Safari private mode can throw.
    }
}
