import { Head } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConsentIdentity } from '@/components/oauth/consent-identity';
import { ConsentScopeList } from '@/components/oauth/consent-scope-list';
import type { ConsentScope } from '@/components/oauth/consent-scope-list';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import AuthLayout from '@/layouts/auth-layout';
import { urlHost } from '@/lib/utils';

type AuthorizeClient = {
    id: string;
    name: string;
    app_url: string | null;
    is_first_party: boolean;
};

type AuthorizeUser = {
    name: string;
    email: string;
    avatar: string | null;
    vout_id: string;
};

type Props = {
    client: AuthorizeClient;
    oauthUser: AuthorizeUser;
    scopes: ConsentScope[];
    authToken: string;
    redirectUri: string;
    csrfToken: string;
};

/**
 * Pantalla de consentimiento OAuth2 (Authorization Code grant).
 *
 * Renderizada por Passport vía `Passport::authorizationView()` solo
 * cuando el cliente NO es first-party.
 *
 * Decisión clave: usamos `<form>` HTML nativos en vez de Inertia
 * `useForm`. Razón crítica: tras aprobar, Passport responde con un
 * 302 al `redirect_uri` del client third-party. El navegador debe
 * **navegar** a esa URL (RFC 6749 §1.7), no seguirla por XHR — un XHR
 * cross-origin tras el 302 dispara el preflight CORS contra el dominio
 * del client (que naturalmente no responde a peticiones del IdP) y el
 * navegador lo bloquea. Con un POST por form nativo, el browser sigue
 * el 302 como navegación normal y todo funciona.
 *
 * Campos hidden requeridos:
 *   - `_token`     → CSRF de Laravel (lo pasa el closure del IdP).
 *   - `auth_token` → emparejamiento Passport ↔ sesión.
 *   - `_method`    → method spoofing para cancelar (Laravel lo enruta
 *                    al DELETE /oauth/authorize).
 */
export default function Authorize({
    client,
    oauthUser,
    scopes,
    authToken,
    redirectUri,
    csrfToken,
}: Props) {
    const { t } = useTranslation();

    // El submit dispara navegación nativa: solo bloqueamos el doble click
    // y mostramos el spinner para que el usuario sepa que algo está pasando
    // mientras el navegador resuelve el 302 cross-origin.
    const [submittingAction, setSubmittingAction] = useState<
        'approve' | 'deny' | null
    >(null);

    const handleSubmit = (
        action: 'approve' | 'deny',
    ): ((event: FormEvent<HTMLFormElement>) => void) => {
        return (event) => {
            if (submittingAction !== null) {
                event.preventDefault();
                return;
            }
            setSubmittingAction(action);
            // No prevenimos el submit: dejamos que el form navegue nativo.
        };
    };

    const isProcessing = submittingAction !== null;
    const redirectHost = redirectUri ? urlHost(redirectUri) : null;

    return (
        <AuthLayout
            title={t('oauth.authorize.title', { app: client.name })}
            description={t('oauth.authorize.description')}
        >
            <Head title={t('oauth.authorize.title', { app: client.name })} />

            <div className="flex flex-col gap-6">
                <ConsentIdentity
                    name={oauthUser.name}
                    email={oauthUser.email}
                    avatar={oauthUser.avatar}
                />

                <ConsentScopeList appName={client.name} scopes={scopes} />

                {/* ── Destino del redirect (transparencia) ─────── */}
                {redirectHost !== null && (
                    <p className="text-xs text-muted-foreground">
                        {t('oauth.authorize.redirect_notice', {
                            host: redirectHost,
                        })}
                    </p>
                )}

                {/* ── Acciones (forms HTML nativos) ────────────── */}
                <div className="flex flex-col gap-2 sm:flex-row-reverse sm:gap-3">
                    <form
                        action="/oauth/authorize"
                        method="POST"
                        onSubmit={handleSubmit('approve')}
                        className="contents"
                        aria-label={t('oauth.authorize.approve_aria')}
                    >
                        <input type="hidden" name="_token" value={csrfToken} />
                        <input
                            type="hidden"
                            name="auth_token"
                            value={authToken}
                        />
                        <Button
                            type="submit"
                            disabled={isProcessing}
                            className="w-full sm:flex-1"
                        >
                            {submittingAction === 'approve' && (
                                <Spinner className="mr-2 size-4" />
                            )}
                            {t('oauth.authorize.approve')}
                        </Button>
                    </form>

                    <form
                        action="/oauth/authorize"
                        method="POST"
                        onSubmit={handleSubmit('deny')}
                        className="contents"
                        aria-label={t('oauth.authorize.deny_aria')}
                    >
                        {/* Method spoofing: Laravel enruta a DELETE /oauth/authorize */}
                        <input type="hidden" name="_method" value="DELETE" />
                        <input type="hidden" name="_token" value={csrfToken} />
                        <input
                            type="hidden"
                            name="auth_token"
                            value={authToken}
                        />
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={isProcessing}
                            className="w-full sm:flex-1"
                        >
                            {submittingAction === 'deny' && (
                                <Spinner className="mr-2 size-4" />
                            )}
                            {t('oauth.authorize.deny')}
                        </Button>
                    </form>
                </div>

                {client.app_url && (
                    <p className="text-center text-[11px] text-muted-foreground">
                        {t('oauth.authorize.app_url_hint', {
                            app: client.name,
                            host: urlHost(client.app_url) ?? client.app_url,
                        })}
                    </p>
                )}
            </div>
        </AuthLayout>
    );
}
