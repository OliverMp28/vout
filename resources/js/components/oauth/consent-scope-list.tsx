import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export type ConsentScope = {
    id: string;
    description: string;
};

type ConsentScopeListProps = {
    appName: string;
    scopes: ConsentScope[];
};

/**
 * Permisos que una app pide sobre la cuenta del usuario.
 *
 * Compartido por las dos pantallas de consentimiento: la del flujo OAuth
 * (`oauth/authorize`) y la de juegos embebidos (`play/consent`).
 */
export function ConsentScopeList({ appName, scopes }: ConsentScopeListProps) {
    const { t } = useTranslation();

    return (
        <section aria-labelledby="oauth-scopes-heading" className="space-y-3">
            <header className="space-y-1">
                <h2 id="oauth-scopes-heading" className="text-sm font-semibold">
                    {t('oauth.authorize.scopes_heading', { app: appName })}
                </h2>
                <p className="text-xs text-muted-foreground">
                    {t('oauth.authorize.scopes_description')}
                </p>
            </header>

            {scopes.length === 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border px-3 py-3">
                    <ShieldCheck
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                    <p className="text-sm text-muted-foreground">
                        {t('oauth.authorize.scopes_empty')}
                    </p>
                </div>
            ) : (
                <ul className="space-y-2" role="list">
                    {scopes.map((scope) => (
                        <li
                            key={scope.id}
                            className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5"
                        >
                            <CheckCircle2
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden
                            />
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">
                                    {scope.description}
                                </p>
                                <p className="font-mono text-[11px] text-muted-foreground">
                                    {scope.id}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
