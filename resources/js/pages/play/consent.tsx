import { Form, Head, Link, usePage } from '@inertiajs/react';
import { ConsentIdentity } from '@/components/oauth/consent-identity';
import { ConsentScopeList } from '@/components/oauth/consent-scope-list';
import type { ConsentScope } from '@/components/oauth/consent-scope-list';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import AuthLayout from '@/layouts/auth-layout';
import { urlHost } from '@/lib/utils';
import { index as catalogIndex } from '@/routes/catalog';
import { store as consentStore } from '@/routes/play/consent';
import type { Auth } from '@/types/auth';

type Props = {
    game: {
        name: string;
        slug: string;
    };
    app: {
        name: string;
        app_url: string | null;
    };
    scopes: ConsentScope[];
};

/**
 * Consentimiento previo a un juego embebido de una app third-party.
 *
 * `PlayController` la renderiza en lugar del juego cuando el usuario aún
 * no ha autorizado la app. Es el equivalente dentro del portal a la
 * pantalla `oauth/authorize` del flujo directo, y deja el mismo registro
 * (revocable en Ajustes → Apps conectadas).
 *
 * A diferencia de `oauth/authorize`, aquí sí usamos `<Form>` de Inertia:
 * tras aprobar no hay redirect a otro dominio, solo se vuelve a
 * `/play/{game}`, ya con el juego.
 */
export default function PlayConsent({ game, app, scopes }: Props) {
    const { t } = useTranslation();
    const { auth } = usePage<{ auth: Auth }>().props;

    const title = t('oauth.authorize.title', { app: app.name });

    return (
        <AuthLayout
            title={title}
            description={t('play.consent.description', {
                game: game.name,
                app: app.name,
            })}
        >
            <Head title={title} />

            <div className="flex flex-col gap-6">
                <ConsentIdentity
                    name={auth.user.name}
                    email={auth.user.email}
                    avatar={auth.user.avatar}
                />

                <ConsentScopeList appName={app.name} scopes={scopes} />

                <Form
                    {...consentStore.form(game.slug)}
                    className="flex flex-col gap-2 sm:flex-row-reverse sm:gap-3"
                >
                    {({ processing }) => (
                        <>
                            <Button
                                id="btn-play-consent-approve"
                                type="submit"
                                disabled={processing}
                                className="w-full sm:flex-1"
                                aria-label={t('play.consent.approve_aria', {
                                    app: app.name,
                                })}
                            >
                                {processing && (
                                    <Spinner className="mr-2 size-4" />
                                )}
                                {t('play.consent.approve')}
                            </Button>
                            <Button
                                asChild
                                id="btn-play-consent-cancel"
                                variant="outline"
                                className="w-full sm:flex-1"
                            >
                                <Link href={catalogIndex.url()}>
                                    {t('play.consent.cancel')}
                                </Link>
                            </Button>
                        </>
                    )}
                </Form>

                {app.app_url && (
                    <p className="text-center text-[11px] text-muted-foreground">
                        {t('oauth.authorize.app_url_hint', {
                            app: app.name,
                            host: urlHost(app.app_url) ?? app.app_url,
                        })}
                    </p>
                )}
            </div>
        </AuthLayout>
    );
}
