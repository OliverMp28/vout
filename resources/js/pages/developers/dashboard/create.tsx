import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { type FormEventHandler, type ReactNode, useMemo } from 'react';
import { DynamicUrlList } from '@/components/developers/dynamic-url-list';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { cn } from '@/lib/utils';
import developers from '@/routes/developers';
import type { AppFormData } from '@/types';

const { apps: appsRoutes, dashboard } = developers;

type ProfileKind = 'with-idp' | 'client-only';

const DEFAULT_FORM: AppFormData = {
    name: '',
    app_url: '',
    allowed_origins: [''],
    requires_auth: true,
    confidential: true,
    redirect_uris: [''],
};

/**
 * Formulario de creación de una app del ecosistema.
 *
 * Dos perfiles seleccionables:
 *   - `with-idp`: requires_auth=true — se emitirá un client OAuth.
 *   - `client-only`: requires_auth=false — sólo declara orígenes para el
 *     handshake postMessage, sin credenciales Passport.
 *
 * `useForm` mantiene el estado y envía a `POST /developers/apps`.
 * Los errores por índice (`allowed_origins.0`, `redirect_uris.1`) se
 * propagan al componente `DynamicUrlList` por prefijo.
 */
export default function DevelopersDashboardCreate() {
    const { t } = useTranslation();

    const { data, setData, post, processing, errors, reset } =
        useForm<AppFormData>(DEFAULT_FORM);

    const profile: ProfileKind = data.requires_auth ? 'with-idp' : 'client-only';

    const setProfile = (kind: ProfileKind): void => {
        if (kind === 'with-idp') {
            setData((previous) => ({
                ...previous,
                requires_auth: true,
                confidential: true,
                redirect_uris:
                    previous.redirect_uris.length === 0
                        ? ['']
                        : previous.redirect_uris,
            }));
        } else {
            setData((previous) => ({
                ...previous,
                requires_auth: false,
                confidential: false,
                redirect_uris: [],
            }));
        }
    };

    const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        post(appsRoutes.store().url, {
            preserveScroll: true,
            onError: () => {
                // Laravel repuebla errors; nada extra que hacer aquí.
            },
        });
    };

    // Derivado para que los errores indexados del DynamicUrlList funcionen aún
    // cuando el usuario haya quitado todas las entradas (requireAtLeastOne).
    const allowedOriginsValues = useMemo(
        () => data.allowed_origins,
        [data.allowed_origins],
    );
    const redirectUrisValues = useMemo(
        () => data.redirect_uris,
        [data.redirect_uris],
    );

    return (
        <>
            <Head title={t('developers.dashboard.create.title')} />

            <div className="space-y-8">
                <header className="space-y-3">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Link href={dashboard().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('developers.dashboard.create.back')}
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            {t('developers.dashboard.create.heading')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('developers.dashboard.create.subheading')}
                        </p>
                    </div>
                </header>

                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
                >
                    <div className="space-y-6">
                        <Section
                            title={t('developers.dashboard.create.profile.heading')}
                            description={t(
                                'developers.dashboard.create.profile.description',
                            )}
                        >
                            <div
                                role="radiogroup"
                                aria-label={t(
                                    'developers.dashboard.create.profile.heading',
                                )}
                                className="grid gap-3 sm:grid-cols-2"
                            >
                                <ProfileOption
                                    kind="with-idp"
                                    selected={profile === 'with-idp'}
                                    onSelect={() => setProfile('with-idp')}
                                    title={t(
                                        'developers.dashboard.create.profile.with_idp.title',
                                    )}
                                    description={t(
                                        'developers.dashboard.create.profile.with_idp.description',
                                    )}
                                    icon={ShieldCheck}
                                />
                                <ProfileOption
                                    kind="client-only"
                                    selected={profile === 'client-only'}
                                    onSelect={() => setProfile('client-only')}
                                    title={t(
                                        'developers.dashboard.create.profile.client_only.title',
                                    )}
                                    description={t(
                                        'developers.dashboard.create.profile.client_only.description',
                                    )}
                                    icon={Sparkles}
                                />
                            </div>
                        </Section>

                        <Section
                            title={t('developers.dashboard.create.meta.heading')}
                            description={t(
                                'developers.dashboard.create.meta.description',
                            )}
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="name">
                                    {t('developers.form.name')}
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(event) =>
                                        setData('name', event.target.value)
                                    }
                                    autoComplete="off"
                                    autoFocus
                                    required
                                    maxLength={80}
                                    aria-invalid={
                                        errors.name !== undefined || undefined
                                    }
                                    placeholder={t(
                                        'developers.form.name_placeholder',
                                    )}
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="app_url">
                                    {t('developers.form.app_url')}
                                </Label>
                                <Input
                                    id="app_url"
                                    type="url"
                                    inputMode="url"
                                    value={data.app_url}
                                    onChange={(event) =>
                                        setData('app_url', event.target.value)
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                    required
                                    maxLength={255}
                                    aria-invalid={
                                        errors.app_url !== undefined || undefined
                                    }
                                    placeholder="https://mi-app.com"
                                    className="font-mono text-sm"
                                />
                                <InputError message={errors.app_url} />
                            </div>
                        </Section>

                        <Section
                            title={t(
                                'developers.dashboard.create.origins.heading',
                            )}
                            description={t(
                                'developers.dashboard.create.origins.description',
                            )}
                        >
                            <DynamicUrlList
                                id="allowed-origins"
                                label={t('developers.form.allowed_origins')}
                                description={t(
                                    'developers.form.allowed_origins_hint',
                                )}
                                placeholder="https://mi-app.com"
                                values={allowedOriginsValues}
                                onChange={(next) =>
                                    setData('allowed_origins', next)
                                }
                                errors={errors as Record<string, string>}
                                fieldName="allowed_origins"
                                max={10}
                                inputType="text"
                            />
                        </Section>

                        {profile === 'with-idp' && (
                            <Section
                                title={t(
                                    'developers.dashboard.create.oauth.heading',
                                )}
                                description={t(
                                    'developers.dashboard.create.oauth.description',
                                )}
                            >
                                <DynamicUrlList
                                    id="redirect-uris"
                                    label={t('developers.form.redirect_uris')}
                                    description={t(
                                        'developers.form.redirect_uris_hint',
                                    )}
                                    placeholder="https://mi-app.com/auth/callback"
                                    values={redirectUrisValues}
                                    onChange={(next) =>
                                        setData('redirect_uris', next)
                                    }
                                    errors={errors as Record<string, string>}
                                    fieldName="redirect_uris"
                                    max={5}
                                />

                                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <Label
                                            htmlFor="confidential"
                                            className="text-sm font-medium"
                                        >
                                            {t('developers.form.confidential')}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                'developers.form.confidential_hint',
                                            )}
                                        </p>
                                    </div>
                                    <Switch
                                        id="confidential"
                                        checked={data.confidential}
                                        onCheckedChange={(checked) =>
                                            setData('confidential', checked)
                                        }
                                    />
                                </div>
                                <InputError message={errors.confidential} />
                            </Section>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={processing}>
                                {processing
                                    ? t('developers.form.submitting')
                                    : t('developers.form.submit_create')}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => reset()}
                                disabled={processing}
                            >
                                {t('developers.form.reset')}
                            </Button>
                        </div>
                    </div>

                    <aside
                        className="order-first h-fit space-y-4 rounded-2xl border border-border bg-card p-6 text-sm shadow-sm lg:order-none lg:sticky lg:top-24"
                        aria-label={t('developers.dashboard.create.help.heading')}
                    >
                        <h2 className="text-base font-semibold tracking-tight">
                            {t('developers.dashboard.create.help.heading')}
                        </h2>
                        <HelpItem
                            title={t(
                                'developers.dashboard.create.help.origins.title',
                            )}
                            description={t(
                                'developers.dashboard.create.help.origins.description',
                            )}
                        />
                        <HelpItem
                            title={t(
                                'developers.dashboard.create.help.redirects.title',
                            )}
                            description={t(
                                'developers.dashboard.create.help.redirects.description',
                            )}
                        />
                        <HelpItem
                            title={t(
                                'developers.dashboard.create.help.confidential.title',
                            )}
                            description={t(
                                'developers.dashboard.create.help.confidential.description',
                            )}
                        />
                    </aside>
                </form>
            </div>
        </>
    );
}

DevelopersDashboardCreate.layout = (page: ReactNode) => (
    <DevelopersLayout>{page}</DevelopersLayout>
);

type SectionProps = {
    title: string;
    description?: string;
    children: ReactNode;
};

function Section({ title, description, children }: SectionProps) {
    return (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

type ProfileOptionProps = {
    kind: ProfileKind;
    selected: boolean;
    onSelect: () => void;
    title: string;
    description: string;
    icon: typeof ShieldCheck;
};

function ProfileOption({
    kind,
    selected,
    onSelect,
    title,
    description,
    icon: Icon,
}: ProfileOptionProps) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={cn(
                'group flex items-start gap-3 rounded-xl border p-4 text-left transition-[box-shadow,background-color,border-color] duration-200',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-accent/30',
            )}
            data-kind={kind}
        >
            <span
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                    selected
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground',
                )}
                aria-hidden
            >
                <Icon className="size-4" />
            </span>
            <div className="space-y-1">
                <span className="block text-sm font-semibold tracking-tight">
                    {title}
                </span>
                <span className="block text-xs text-muted-foreground">
                    {description}
                </span>
            </div>
        </button>
    );
}

type HelpItemProps = {
    title: string;
    description: string;
};

function HelpItem({ title, description }: HelpItemProps) {
    return (
        <div className="space-y-1">
            <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
                {title}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
        </div>
    );
}
