import { useCallback, useSyncExternalStore } from 'react';
import type { CookieConsent } from '@/lib/cookie-consent';
import {
    readConsent,
    resetConsent,
    subscribeConsent,
    writeConsent,
} from '@/lib/cookie-consent';

export type UseCookieConsentReturn = {
    readonly consent: CookieConsent | null;
    readonly hasDecided: boolean;
    readonly accept: () => void;
    readonly reject: () => void;
    readonly save: (preferences: boolean) => void;
    readonly reopen: () => void;
};

export function useCookieConsent(): UseCookieConsentReturn {
    const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);

    const accept = useCallback((): void => {
        writeConsent(true);
    }, []);

    const reject = useCallback((): void => {
        writeConsent(false);
    }, []);

    const save = useCallback((preferences: boolean): void => {
        writeConsent(preferences);
    }, []);

    const reopen = useCallback((): void => {
        resetConsent();
    }, []);

    return {
        consent,
        hasDecided: consent !== null,
        accept,
        reject,
        save,
        reopen,
    } as const;
}
