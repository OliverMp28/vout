import { Head } from '@inertiajs/react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import AuthLayout from '@/layouts/auth-layout';

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

type AuthorizeScope = {
    id: string;
    description: string;
};

type Props = {
    client: AuthorizeClient;
    oauthUser: AuthorizeUser;
    scopes: AuthorizeScope[];
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
    const redirectHost = redirectUri ? safeHost(redirectUri) : null;

    const initials = oauthUser.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');

    return (
        <AuthLayout
            title={t('oauth.authorize.title', { app: client.name })}
            description={t('oauth.authorize.description')}
        >
            <Head title={t('oauth.authorize.title', { app: client.name })} />

            <div className="flex flex-col gap-6">
                {/* ── Identidad activa ─────────────────────────── */}
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                    <Avatar className="size-10 shrink-0">
                        <AvatarImage
                            src={oauthUser.avatar ?? undefined}
                            alt={oauthUser.name}
                        />
                        <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                            {initials || '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">
                            {oauthUser.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {oauthUser.email}
                        </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {t('oauth.authorize.signed_in_badge')}
                    </span>
                </div>

                {/* ── Permisos solicitados ─────────────────────── */}
                <section
                    aria-labelledby="oauth-scopes-heading"
                    className="space-y-3"
                >
                    <header className="space-y-1">
                        <h2
                            id="oauth-scopes-heading"
                            className="text-sm font-semibold"
                        >
                            {t('oauth.authorize.scopes_heading', {
                                app: client.name,
                            })}
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
                            host: safeHost(client.app_url) ?? client.app_url,
                        })}
                    </p>
                )}
            </div>
        </AuthLayout>
    );
}

/**
 * Devuelve solo el host de una URL — útil para mostrar dónde acabará el
 * usuario sin enseñarle un querystring lleno de parámetros internos.
 * Devuelve `null` si la URL no parsea (entrada corrupta).
 */
function safeHost(url: string): string | null {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}
