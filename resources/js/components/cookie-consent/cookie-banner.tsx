import { Link, usePage } from '@inertiajs/react';
import { Cookie } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/hooks/use-cookie-consent';
import { useTranslation } from '@/hooks/use-translation';
import { show as legalShow } from '@/routes/legal';
import type { Auth } from '@/types';
import { CookiePreferencesDialog } from './cookie-preferences-dialog';

const subscribeNoop = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

/**
 * Floating consent banner. Renders only when the user has not yet
 * decided. Three buttons with equivalent reach (Accept · Reject ·
 * Preferences) per the AEPD 2024 cookie guidance — none is hidden
 * behind a secondary panel.
 *
 * Para usuarios logueados no se muestra: el tema vive en BD como dato
 * de cuenta y `sidebar_state` es estado funcional UI; no quedan cookies
 * de "preferencia" sujetas a consentimiento. El diálogo sí se monta
 * siempre para que el botón "Gestionar cookies" del footer funcione.
 */
export function CookieBanner() {
    const { hasDecided, accept, reject } = useCookieConsent();
    const { t } = useTranslation();
    const page = usePage<{ auth: Auth }>();
    const isAuthenticated = page.props.auth?.user != null;
    const isClient = useSyncExternalStore(
        subscribeNoop,
        getClientSnapshot,
        getServerSnapshot,
    );
    const [preferencesOpen, setPreferencesOpen] = useState(false);

    if (!isClient || hasDecided || isAuthenticated) {
        return (
            <CookiePreferencesDialog
                open={preferencesOpen}
                onOpenChange={setPreferencesOpen}
            />
        );
    }

    return (
        <>
            <div
                role="dialog"
                aria-modal="false"
                aria-labelledby="cookie-banner-title"
                aria-describedby="cookie-banner-description"
                className="fixed inset-x-3 bottom-3 z-50 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm"
            >
                <div className="rounded-surface border bg-surface-2 p-5 shadow-overlay">
                    <div className="flex items-start gap-3">
                        <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-muted-foreground"
                        >
                            <Cookie className="size-4" />
                        </span>
                        <div className="space-y-1.5">
                            <h2
                                id="cookie-banner-title"
                                className="text-sm font-bold text-foreground"
                            >
                                {t('cookie.banner.title')}
                            </h2>
                            <p
                                id="cookie-banner-description"
                                className="text-xs leading-relaxed text-muted-foreground"
                            >
                                {t('cookie.banner.description')}{' '}
                                <Link
                                    href={legalShow('cookies').url}
                                    className="font-semibold text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-signal-strong"
                                >
                                    {t('cookie.banner.learn_more')}
                                </Link>
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                            type="button"
                            size="sm"
                            onClick={accept}
                            className="sm:flex-1"
                        >
                            {t('cookie.banner.accept')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={reject}
                            className="sm:flex-1"
                        >
                            {t('cookie.banner.reject')}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreferencesOpen(true)}
                            className="sm:w-full"
                        >
                            {t('cookie.banner.preferences')}
                        </Button>
                    </div>
                </div>
            </div>

            <CookiePreferencesDialog
                open={preferencesOpen}
                onOpenChange={setPreferencesOpen}
            />
        </>
    );
}
