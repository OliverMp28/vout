import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronRight,
    MonitorSmartphone,
    Plus,
    Server,
    ShieldCheck,
    Sparkles,
    X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ComponentType, ReactNode, SubmitEvent } from 'react';
import { DynamicUrlList } from '@/components/developers/dynamic-url-list';
import { FlowDiagram } from '@/components/developers/flow-diagram';
import { InfoHint } from '@/components/developers/info-hint';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
 * Dos perfiles seleccionables (`with-idp` / `client-only`) y autorrelleno del
 * primer dominio autorizado a partir de la URL del sitio web. Los dominios
 * adicionales viven en un Collapsible para no abrumar al dev novato.
 */
export default function DevelopersDashboardCreate() {
    const { t } = useTranslation();

    const { data, setData, post, processing, errors, reset } =
        useForm<AppFormData>(DEFAULT_FORM);

    const profile: ProfileKind = data.requires_auth ? 'with-idp' : 'client-only';

    // Última origin derivada de app_url. Permite distinguir entre "el dev no
    // ha tocado el dominio principal" (lo actualizamos) y "lo editó a mano"
    // (lo respetamos).
    const lastDerivedOriginRef = useRef<string>('');

    const [extrasOpen, setExtrasOpen] = useState(
        data.allowed_origins.length > 1,
    );

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

    const handleAppUrlChange = (value: string): void => {
        const derived = safeOrigin(value);
        setData((previous) => {
            const nextOrigins =
                previous.allowed_origins.length > 0
                    ? [...previous.allowed_origins]
                    : [''];
            if (derived !== null) {
                const current = nextOrigins[0] ?? '';
                const wasAuto =
                    current === '' ||
                    current === lastDerivedOriginRef.current;
                if (wasAuto) {
                    nextOrigins[0] = derived;
                    lastDerivedOriginRef.current = derived;
                }
            }
            return {
                ...previous,
                app_url: value,
                allowed_origins: nextOrigins,
            };
        });
    };

    const updatePrimaryOrigin = (value: string): void => {
        setData((previous) => {
            const next =
                previous.allowed_origins.length > 0
                    ? [...previous.allowed_origins]
                    : [''];
            next[0] = value;
            return { ...previous, allowed_origins: next };
        });
    };

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        post(appsRoutes.store().url, {
            preserveScroll: true,
        });
    };

    const extras = useMemo(
        () => data.allowed_origins.slice(1),
        [data.allowed_origins],
    );

    const setExtras = (next: string[]): void => {
        setData((previous) => {
            const primary = previous.allowed_origins[0] ?? '';
            return {
                ...previous,
                allowed_origins: [primary, ...next],
            };
        });
    };

    const addExtraOrigin = (): void => {
        setExtras([...extras, '']);
        setExtrasOpen(true);
    };

    const updateExtraOrigin = (index: number, value: string): void => {
        const next = [...extras];
        next[index] = value;
        setExtras(next);
    };

    const removeExtraOrigin = (index: number): void => {
        setExtras(extras.filter((_, i) => i !== index));
    };

    const redirectUrisValues = useMemo(
        () => data.redirect_uris,
        [data.redirect_uris],
    );

    const primaryOriginError =
        (errors as Record<string, string>)['allowed_origins.0'] ??
        errors.allowed_origins;

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
                                <LabelWithHint
                                    htmlFor="app_url"
                                    label={t('developers.form.app_url')}
                                    hintLabel={t(
                                        'developers.hints.app_url.label',
                                    )}
                                    hintBody={t('developers.hints.app_url.body')}
                                />
                                <Input
                                    id="app_url"
                                    type="url"
                                    inputMode="url"
                                    value={data.app_url}
                                    onChange={(event) =>
                                        handleAppUrlChange(event.target.value)
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
                                <p className="text-xs text-muted-foreground">
                                    {t('developers.form.app_url_hint')}
                                </p>
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
                            <div className="grid gap-2">
                                <LabelWithHint
                                    htmlFor="allowed-origin-primary"
                                    label={t(
                                        'developers.form.allowed_origins',
                                    )}
                                    hintLabel={t(
                                        'developers.hints.allowed_origins.label',
                                    )}
                                    hintBody={t(
                                        'developers.hints.allowed_origins.body',
                                    )}
                                />
                                <Input
                                    id="allowed-origin-primary"
                                    type="text"
                                    value={data.allowed_origins[0] ?? ''}
                                    onChange={(event) =>
                                        updatePrimaryOrigin(event.target.value)
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                    required
                                    maxLength={255}
                                    aria-invalid={
                                        primaryOriginError !== undefined ||
                                        undefined
                                    }
                                    placeholder="https://mi-app.com"
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'developers.form.allowed_origins_auto_hint',
                                    )}
                                </p>
                                <InputError message={primaryOriginError} />
                            </div>

                            <Collapsible
                                open={extrasOpen}
                                onOpenChange={setExtrasOpen}
                                className="space-y-3"
                            >
                                <CollapsibleTrigger
                                    className={cn(
                                        'group inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors',
                                        'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    )}
                                >
                                    <ChevronRight
                                        className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
                                        aria-hidden
                                    />
                                    {extrasOpen
                                        ? t(
                                              'developers.dashboard.create.origins.advanced_close',
                                          )
                                        : t(
                                              'developers.dashboard.create.origins.advanced_open',
                                          )}
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-3">
                                    {extras.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                'developers.form.allowed_origins_hint',
                                            )}
                                        </p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {extras.map((value, index) => {
                                                const fieldError = (
                                                    errors as Record<
                                                        string,
                                                        string
                                                    >
                                                )[
                                                    `allowed_origins.${index + 1}`
                                                ];
                                                return (
                                                    <li
                                                        key={`extra-origin-${index}`}
                                                        className="flex items-start gap-2"
                                                    >
                                                        <div className="flex-1 space-y-1">
                                                            <Input
                                                                type="text"
                                                                value={value}
                                                                onChange={(event) =>
                                                                    updateExtraOrigin(
                                                                        index,
                                                                        event.target
                                                                            .value,
                                                                    )
                                                                }
                                                                autoComplete="off"
                                                                spellCheck={false}
                                                                maxLength={255}
                                                                aria-invalid={
                                                                    fieldError !==
                                                                        undefined ||
                                                                    undefined
                                                                }
                                                                placeholder="https://otro-dominio.com"
                                                                className="font-mono text-sm"
                                                            />
                                                            <InputError
                                                                message={fieldError}
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                removeExtraOrigin(
                                                                    index,
                                                                )
                                                            }
                                                            aria-label={t(
                                                                'developers.form.remove_entry',
                                                            )}
                                                            className="text-muted-foreground hover:text-destructive"
                                                        >
                                                            <X
                                                                className="size-4"
                                                                aria-hidden
                                                            />
                                                        </Button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addExtraOrigin}
                                        disabled={
                                            data.allowed_origins.length >= 10
                                        }
                                        className="gap-1.5"
                                    >
                                        <Plus className="size-3.5" aria-hidden />
                                        {t('developers.form.add_entry')}
                                    </Button>
                                </CollapsibleContent>
                            </Collapsible>
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
                                    hint={{
                                        label: t(
                                            'developers.hints.redirect_uris.label',
                                        ),
                                        body: t(
                                            'developers.hints.redirect_uris.body',
                                        ),
                                    }}
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

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-semibold tracking-tight">
                                            {t(
                                                'developers.form.client_type.heading',
                                            )}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                'developers.form.client_type.description',
                                            )}
                                        </p>
                                    </div>
                                    <div
                                        role="radiogroup"
                                        aria-label={t(
                                            'developers.form.client_type.heading',
                                        )}
                                        className="grid gap-3 sm:grid-cols-2"
                                    >
                                        <ClientTypeOption
                                            selected={data.confidential}
                                            onSelect={() =>
                                                setData('confidential', true)
                                            }
                                            title={t(
                                                'developers.form.client_type.confidential.title',
                                            )}
                                            description={t(
                                                'developers.form.client_type.confidential.description',
                                            )}
                                            badge={t(
                                                'developers.form.client_type.confidential.badge',
                                            )}
                                            icon={Server}
                                        />
                                        <ClientTypeOption
                                            selected={!data.confidential}
                                            onSelect={() =>
                                                setData('confidential', false)
                                            }
                                            title={t(
                                                'developers.form.client_type.public.title',
                                            )}
                                            description={t(
                                                'developers.form.client_type.public.description',
                                            )}
                                            badge={t(
                                                'developers.form.client_type.public.badge',
                                            )}
                                            icon={MonitorSmartphone}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t(
                                            'developers.form.client_type.note',
                                        )}
                                    </p>
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
                        className="order-first h-fit space-y-4 rounded-2xl border border-border bg-card p-6 text-sm shadow-sm lg:order-0 lg:sticky lg:top-24"
                        aria-label={t('developers.dashboard.create.help.heading')}
                    >
                        <h2 className="text-base font-semibold tracking-tight">
                            {t('developers.dashboard.create.help.heading')}
                        </h2>
                        <FlowDiagram variant="app" />
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

type LabelWithHintProps = {
    htmlFor: string;
    label: string;
    hintLabel: string;
    hintBody: string;
    labelClassName?: string;
};

function LabelWithHint({
    htmlFor,
    label,
    hintLabel,
    hintBody,
    labelClassName,
}: LabelWithHintProps) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Label htmlFor={htmlFor} className={labelClassName}>
                {label}
            </Label>
            <InfoHint label={hintLabel}>
                <p>{hintBody}</p>
            </InfoHint>
        </span>
    );
}

type IconType = ComponentType<{ className?: string }>;

type ClientTypeOptionProps = {
    selected: boolean;
    onSelect: () => void;
    title: string;
    description: string;
    badge: string;
    icon: IconType;
};

function ClientTypeOption({
    selected,
    onSelect,
    title,
    description,
    badge,
    icon: Icon,
}: ClientTypeOptionProps) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={cn(
                'group flex flex-col gap-3 rounded-xl border p-4 text-left transition-[box-shadow,background-color,border-color] duration-200',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-accent/30',
            )}
        >
            <div className="flex items-center gap-2.5">
                <span
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                        selected
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-muted text-muted-foreground',
                    )}
                    aria-hidden
                >
                    <Icon className="size-4" />
                </span>
                <span className="block text-sm font-semibold tracking-tight">
                    {title}
                </span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            <span
                className={cn(
                    'inline-flex w-fit items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase',
                    selected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted/50 text-muted-foreground',
                )}
            >
                {badge}
            </span>
        </button>
    );
}

type ProfileOptionProps = {
    kind: ProfileKind;
    selected: boolean;
    onSelect: () => void;
    title: string;
    description: string;
    icon: IconType;
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

function safeOrigin(value: string): string | null {
    if (value.trim() === '') {
        return null;
    }
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}
