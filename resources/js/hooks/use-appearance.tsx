import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { preferencesAllowed } from '@/lib/cookie-consent';
import { update as updateUserSettings } from '@/routes/user-settings';
import type { Auth } from '@/types';

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

export type UseAppearanceReturn = {
    readonly appearance: Appearance;
    readonly resolvedAppearance: ResolvedAppearance;
    readonly updateAppearance: (mode: Appearance) => void;
};

const APPEARANCE_VALUES: readonly Appearance[] = [
    'light',
    'dark',
    'system',
] as const;
const COOKIE_NAME = 'appearance';
const STORAGE_KEY = 'appearance';

const listeners = new Set<() => void>();
let currentAppearance: Appearance = 'system';

const isAppearance = (value: unknown): value is Appearance =>
    typeof value === 'string' &&
    (APPEARANCE_VALUES as readonly string[]).includes(value);

const prefersDark = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') {
        return;
    }
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getStoredAppearance = (): Appearance => {
    if (typeof window === 'undefined') {
        return 'system';
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);

    return isAppearance(stored) ? stored : 'system';
};

const isDarkMode = (appearance: Appearance): boolean => {
    return appearance === 'dark' || (appearance === 'system' && prefersDark());
};

const applyTheme = (appearance: Appearance): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const isDark = isDarkMode(appearance);

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const setCurrent = (mode: Appearance): void => {
    currentAppearance = mode;
    applyTheme(mode);
    notify();
};

const mediaQuery = (): MediaQueryList | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = (): void => applyTheme(currentAppearance);

/**
 * Carga inicial del tema antes de que React monte.
 *
 * Sólo lee del carrier client-side (cookie/localStorage) para evitar
 * el "flash of unstyled content". Si el usuario está logueado y su
 * preferencia en BD difiere, `useAppearance` reconcilia tras montar.
 */
export function initializeTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    currentAppearance = getStoredAppearance();
    applyTheme(currentAppearance);

    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

export function useAppearance(): UseAppearanceReturn {
    const page = usePage<{ auth: Auth }>();
    const user = page.props.auth?.user ?? null;
    const dbAppearance: Appearance | null = isAppearance(
        user?.settings?.appearance,
    )
        ? (user!.settings!.appearance as Appearance)
        : null;
    const isAuthenticated = user !== null;

    // Reconcilia el carrier local con la preferencia de cuenta cuando
    // el usuario está logueado: la BD es la fuente de verdad y la cookie
    // sólo actúa como espejo para sobrevivir al primer paint sin parpadeos.
    useEffect(() => {
        if (!isAuthenticated || dbAppearance === null) {
            return;
        }

        if (dbAppearance !== currentAppearance) {
            setCurrent(dbAppearance);
        }

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, dbAppearance);
        }
        setCookie(COOKIE_NAME, dbAppearance);
    }, [isAuthenticated, dbAppearance]);

    const appearance: Appearance = useSyncExternalStore(
        subscribe,
        () => currentAppearance,
        () => 'system',
    );

    const resolvedAppearance: ResolvedAppearance = useMemo(
        () => (isDarkMode(appearance) ? 'dark' : 'light'),
        [appearance],
    );

    const updateAppearance = useCallback(
        (mode: Appearance): void => {
            setCurrent(mode);

            if (isAuthenticated) {
                // Espejo en cookie: el tema sigue siendo "datos de cuenta"
                // y no requiere consentimiento; sirve sólo para evitar el
                // FOUC en la próxima carga antes de que hidrate React.
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(STORAGE_KEY, mode);
                }
                setCookie(COOKIE_NAME, mode);

                router.patch(
                    updateUserSettings().url,
                    { appearance: mode },
                    { preserveScroll: true, preserveState: true, only: [] },
                );

                return;
            }

            if (preferencesAllowed()) {
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(STORAGE_KEY, mode);
                }
                setCookie(COOKIE_NAME, mode);
            }
        },
        [isAuthenticated],
    );

    return { appearance, resolvedAppearance, updateAppearance } as const;
}
