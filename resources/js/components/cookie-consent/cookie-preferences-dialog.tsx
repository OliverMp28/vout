import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useCookieConsent } from '@/hooks/use-cookie-consent';
import { useTranslation } from '@/hooks/use-translation';
import { show as legalShow } from '@/routes/legal';
import type { Auth } from '@/types';

type Props = {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
};

/**
 * Granular preferences panel. El grupo "técnicas" se muestra con un
 * badge "Siempre activas" en lugar de un Switch inerte: comunica que
 * son obligatorias (exentas bajo art. 22.2 LSSI-CE) sin simular un
 * control falso. Para usuarios autenticados ocultamos el grupo de
 * preferencias porque su tema/sidebar viven en la cuenta y no hay
 * cookies de preferencia que controlar aquí.
 */
export function CookiePreferencesDialog({ open, onOpenChange }: Props) {
    const { consent, save } = useCookieConsent();
    const { t } = useTranslation();
    const page = usePage<{ auth: Auth }>();
    const isAuthenticated = page.props.auth?.user != null;
    const [preferences, setPreferences] = useState<boolean>(
        consent?.preferences ?? false,
    );
    const [prevOpen, setPrevOpen] = useState<boolean>(open);

    // Adjust state during render (React 19 idiomatic) to resync the toggle
    // with the stored consent each time the dialog transitions to open —
    // including after a "reset" from the footer link.
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) {
            setPreferences(consent?.preferences ?? false);
        }
    }

    const handleSave = (): void => {
        save(preferences);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('cookie.dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('cookie.dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <article className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <header className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    {t('cookie.dialog.technical.title')}
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t('cookie.dialog.technical.description')}
                                </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                                {t('cookie.dialog.technical.always_on')}
                            </Badge>
                        </header>
                    </article>

                    {isAuthenticated ? (
                        <p className="rounded-lg border border-dashed border-border/60 bg-background px-4 py-3 text-xs text-muted-foreground">
                            {t('cookie.dialog.authenticated_note')}
                        </p>
                    ) : (
                        <article className="rounded-lg border border-border/60 bg-background p-4">
                            <header className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {t('cookie.dialog.preferences.title')}
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {t('cookie.dialog.preferences.description')}
                                    </p>
                                </div>
                                <Switch
                                    checked={preferences}
                                    onCheckedChange={setPreferences}
                                    aria-label={t('cookie.dialog.preferences.title')}
                                />
                            </header>
                        </article>
                    )}
                </div>

                <p className="text-xs text-muted-foreground">
                    {t('cookie.dialog.see_more')}{' '}
                    <Link
                        href={legalShow('cookies').url}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('cookie.dialog.see_policy')}
                    </Link>
                </p>

                <DialogFooter>
                    {isAuthenticated ? (
                        <Button type="button" onClick={() => onOpenChange(false)}>
                            {t('cookie.dialog.close')}
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                {t('cookie.dialog.cancel')}
                            </Button>
                            <Button type="button" onClick={handleSave}>
                                {t('cookie.dialog.save')}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
