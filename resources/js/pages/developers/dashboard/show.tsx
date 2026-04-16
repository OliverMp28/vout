import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Key,
    Pause,
    Play,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { CopyButton } from '@/components/developers/copy-button';
import { DynamicUrlList } from '@/components/developers/dynamic-url-list';
import { SecretRevealDialog } from '@/components/developers/secret-reveal-dialog';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { cn } from '@/lib/utils';
import developers from '@/routes/developers';
import type { DevelopersAppShowProps } from '@/types';

const { apps: appsRoutes, dashboard } = developers;

type TabKey = 'overview' | 'credentials' | 'origins' | 'danger';

/**
 * Detalle de la app + operaciones (fase 4.1, S4).
 *
 * Tabs:
 *   - overview: metadatos y estados
 *   - credentials: client_id + regenerar secreto (sólo con IdP)
 *   - origins: allowed_origins (+ redirect_uris si con IdP) editables
 *   - danger: pausa/reactivar + eliminar
 *
 * El secreto en claro (`created_client_secret`) llega como flash prop tras
 * crear la app o regenerar el secreto. Se muestra en un `Dialog` una sola
 * vez y al cerrar queda almacenado únicamente en el gestor de contraseñas
 * del usuario.
 */
export default function DevelopersDashboardShow({
    app,
    client,
    created_client_secret,
}: DevelopersAppShowProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    // Estado derivado: mostrar el secreto mientras exista en la flash prop y
    // el usuario no lo haya descartado. `dismissedSecret` guarda el último
    // valor cerrado para que, si el backend devuelve otro distinto (flujo
    // regenerar), el Dialog vuelva a abrirse sin efectos.
    const [dismissedSecret, setDismissedSecret] = useState<string | null>(null);
    const secretShown =
        created_client_secret !== null &&
        created_client_secret !== dismissedSecret
            ? created_client_secret
            : null;

    const hasClient = client !== null;
    const availableTabs: readonly TabKey[] = hasClient
        ? ['overview', 'credentials', 'origins', 'danger']
        : ['overview', 'origins', 'danger'];

    return (
        <>
            <Head title={app.name} />

            <div className="space-y-6">
                <header className="space-y-4">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Link href={dashboard().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('developers.dashboard.show.back')}
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                                    {app.name}
                                </h1>
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        'shrink-0 text-[10px] font-semibold uppercase tracking-wider',
                                        app.is_active
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    {app.is_active
                                        ? t(
                                              'developers.dashboard.index.status.active',
                                          )
                                        : t(
                                              'developers.dashboard.index.status.paused',
                                          )}
                                </Badge>
                            </div>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                                {app.slug}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {app.requires_auth ? (
                                <ProfileChip
                                    icon={ShieldCheck}
                                    label={t(
                                        'developers.dashboard.index.profile.idp',
                                    )}
                                    tone="primary"
                                />
                            ) : (
                                <ProfileChip
                                    icon={Sparkles}
                                    label={t(
                                        'developers.dashboard.index.profile.client_only',
                                    )}
                                    tone="muted"
                                />
                            )}
                        </div>
                    </div>
                </header>

                <Tabs
                    value={activeTab}
                    onValueChange={(next) => setActiveTab(next as TabKey)}
                    className="gap-6"
                >
                    <TabsList className="flex w-full flex-wrap gap-1">
                        {availableTabs.map((key) => (
                            <TabsTrigger key={key} value={key}>
                                {t(`developers.dashboard.show.tabs.${key}`)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="overview">
                        <OverviewPanel app={app} />
                    </TabsContent>

                    {hasClient && (
                        <TabsContent value="credentials">
                            <CredentialsPanel
                                clientId={client.id}
                                confidential={client.confidential}
                                appSlug={app.slug}
                            />
                        </TabsContent>
                    )}

                    <TabsContent value="origins">
                        <OriginsPanel
                            app={app}
                            redirectUris={client?.redirect_uris ?? null}
                            requiresAuth={app.requires_auth}
                        />
                    </TabsContent>

                    <TabsContent value="danger">
                        <DangerPanel app={app} />
                    </TabsContent>
                </Tabs>
            </div>

            <SecretRevealDialog
                secret={secretShown}
                clientId={client?.id ?? null}
                onClose={() => {
                    setDismissedSecret(created_client_secret);
                    // Fuerza al backend a re-rendear sin el flash. Si el usuario
                    // recarga la página, `created_client_secret` ya habrá sido
                    // consumido por la sesión — pero mantenemos esta llamada
                    // por si quedaran otros bits en la sesión.
                    router.reload({
                        only: ['created_client_secret'],
                        preserveUrl: true,
                    });
                }}
            />
        </>
    );
}

DevelopersDashboardShow.layout = (page: ReactNode) => (
    <DevelopersLayout>{page}</DevelopersLayout>
);

type OverviewPanelProps = {
    app: DevelopersAppShowProps['app'];
};

function OverviewPanel({ app }: OverviewPanelProps) {
    const { t } = useTranslation();
    return (
        <Panel
            title={t('developers.dashboard.show.overview.heading')}
            description={t('developers.dashboard.show.overview.description')}
        >
            <dl className="grid gap-4 sm:grid-cols-2">
                <MetaRow
                    label={t('developers.dashboard.show.overview.name')}
                    value={app.name}
                />
                <MetaRow
                    label={t('developers.dashboard.show.overview.slug')}
                    value={app.slug}
                    monospace
                />
                <MetaRow
                    label={t('developers.dashboard.show.overview.app_url')}
                    value={app.app_url}
                    monospace
                />
                <MetaRow
                    label={t('developers.dashboard.show.overview.updated_at')}
                    value={new Date(app.updated_at).toLocaleString()}
                />
            </dl>
        </Panel>
    );
}

type MetaRowProps = {
    label: string;
    value: string;
    monospace?: boolean;
};

function MetaRow({ label, value, monospace }: MetaRowProps) {
    return (
        <div className="space-y-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd
                className={cn(
                    'break-all text-sm',
                    monospace && 'font-mono text-xs',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

type CredentialsPanelProps = {
    clientId: string;
    confidential: boolean;
    appSlug: string;
};

function CredentialsPanel({
    clientId,
    confidential,
    appSlug,
}: CredentialsPanelProps) {
    const { t } = useTranslation();
    const [confirmOpen, setConfirmOpen] = useState(false);

    const { post, processing } = useForm({});

    const handleRegenerate = (): void => {
        post(appsRoutes.secret(appSlug).url, {
            preserveScroll: true,
            onFinish: () => setConfirmOpen(false),
        });
    };

    return (
        <Panel
            title={t('developers.dashboard.show.credentials.heading')}
            description={t('developers.dashboard.show.credentials.description')}
        >
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t('developers.secret.client_id_label')}
                </Label>
                <div className="flex items-stretch gap-2">
                    <code className="flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-sm break-all">
                        {clientId}
                    </code>
                    <CopyButton value={clientId} label={t('developers.secret.copy')} />
                </div>
            </div>

            <Alert variant="default" className="border-muted-foreground/20">
                <Key className="size-4 text-muted-foreground" />
                <AlertTitle>
                    {t('developers.dashboard.show.credentials.secret_title')}
                </AlertTitle>
                <AlertDescription>
                    {t('developers.dashboard.show.credentials.secret_body')}
                </AlertDescription>
            </Alert>

            {confidential && (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirmOpen(true)}
                        className="gap-2"
                        disabled={processing}
                    >
                        <RefreshCw
                            className={cn(
                                'size-4',
                                processing && 'animate-spin',
                            )}
                            aria-hidden
                        />
                        {t('developers.dashboard.show.credentials.regenerate')}
                    </Button>

                    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>
                                    {t(
                                        'developers.dashboard.show.credentials.regenerate_confirm_title',
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'developers.dashboard.show.credentials.regenerate_confirm_body',
                                    )}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setConfirmOpen(false)}
                                    disabled={processing}
                                >
                                    {t('developers.form.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleRegenerate}
                                    disabled={processing}
                                >
                                    {t(
                                        'developers.dashboard.show.credentials.regenerate',
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </Panel>
    );
}

type OriginsPanelProps = {
    app: DevelopersAppShowProps['app'];
    redirectUris: readonly string[] | null;
    requiresAuth: boolean;
};

function OriginsPanel({ app, redirectUris, requiresAuth }: OriginsPanelProps) {
    const { t } = useTranslation();

    type OriginsFormData = {
        allowed_origins: string[];
        redirect_uris: string[];
    };

    const { data, setData, put, processing, errors, isDirty, reset } =
        useForm<OriginsFormData>({
            allowed_origins: [...app.allowed_origins],
            redirect_uris:
                redirectUris !== null ? [...redirectUris] : [],
        });

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        put(appsRoutes.update(app.slug).url, {
            preserveScroll: true,
        });
    };

    return (
        <Panel
            title={t('developers.dashboard.show.origins.heading')}
            description={t('developers.dashboard.show.origins.description')}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <DynamicUrlList
                    id="origins-allowed"
                    label={t('developers.form.allowed_origins')}
                    hint={{
                        label: t('developers.hints.allowed_origins.label'),
                        body: t('developers.hints.allowed_origins.body'),
                    }}
                    description={t('developers.form.allowed_origins_hint')}
                    placeholder="https://mi-app.com"
                    values={data.allowed_origins}
                    onChange={(next) => setData('allowed_origins', next)}
                    errors={errors as Record<string, string>}
                    fieldName="allowed_origins"
                    max={10}
                    inputType="text"
                />

                {requiresAuth && redirectUris !== null && (
                    <DynamicUrlList
                        id="origins-redirects"
                        label={t('developers.form.redirect_uris')}
                        hint={{
                            label: t('developers.hints.redirect_uris.label'),
                            body: t('developers.hints.redirect_uris.body'),
                        }}
                        description={t('developers.form.redirect_uris_hint')}
                        placeholder="https://mi-app.com/auth/callback"
                        values={data.redirect_uris}
                        onChange={(next) => setData('redirect_uris', next)}
                        errors={errors as Record<string, string>}
                        fieldName="redirect_uris"
                        max={5}
                    />
                )}

                <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={processing || !isDirty}>
                        {processing
                            ? t('developers.form.submitting')
                            : t('developers.form.submit_save')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => reset()}
                        disabled={processing || !isDirty}
                    >
                        {t('developers.form.reset')}
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

type DangerPanelProps = {
    app: DevelopersAppShowProps['app'];
};

function DangerPanel({ app }: DangerPanelProps) {
    const { t } = useTranslation();

    const togglePost = useForm({});

    const handleToggle = (): void => {
        togglePost.post(appsRoutes.toggle(app.slug).url, {
            preserveScroll: true,
        });
    };

    return (
        <Panel
            title={t('developers.dashboard.show.danger.heading')}
            description={t('developers.dashboard.show.danger.description')}
            tone="danger"
        >
            <DangerRow
                title={
                    app.is_active
                        ? t('developers.dashboard.show.danger.pause.title')
                        : t('developers.dashboard.show.danger.resume.title')
                }
                description={
                    app.is_active
                        ? t(
                              'developers.dashboard.show.danger.pause.description',
                          )
                        : t(
                              'developers.dashboard.show.danger.resume.description',
                          )
                }
                action={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleToggle}
                        disabled={togglePost.processing}
                        className="gap-2"
                    >
                        {app.is_active ? (
                            <>
                                <Pause className="size-4" aria-hidden />
                                {t('developers.dashboard.show.danger.pause.cta')}
                            </>
                        ) : (
                            <>
                                <Play className="size-4" aria-hidden />
                                {t('developers.dashboard.show.danger.resume.cta')}
                            </>
                        )}
                    </Button>
                }
            />

            <DeleteSection app={app} />
        </Panel>
    );
}

type DeleteSectionProps = {
    app: DevelopersAppShowProps['app'];
};

function DeleteSection({ app }: DeleteSectionProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');

    const { delete: destroy, processing } = useForm({});

    const canDelete = confirmation === app.slug;

    const handleDelete = (): void => {
        if (!canDelete) {
            return;
        }
        destroy(appsRoutes.destroy(app.slug).url, {
            preserveScroll: false,
        });
    };

    return (
        <DangerRow
            title={t('developers.dashboard.show.danger.delete.title')}
            description={t('developers.dashboard.show.danger.delete.description')}
            action={
                <>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                            setConfirmation('');
                            setOpen(true);
                        }}
                        className="gap-2"
                        disabled={processing}
                    >
                        <Trash2 className="size-4" aria-hidden />
                        {t('developers.dashboard.show.danger.delete.cta')}
                    </Button>

                    <Dialog
                        open={open}
                        onOpenChange={(next) => {
                            if (!processing) {
                                setOpen(next);
                            }
                        }}
                    >
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>
                                    {t(
                                        'developers.dashboard.show.danger.delete.confirm_title',
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'developers.dashboard.show.danger.delete.confirm_body',
                                        { slug: app.slug },
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <Alert variant="default" className="border-destructive/40">
                                <AlertTriangle className="size-4 text-destructive" />
                                <AlertTitle>
                                    {t(
                                        'developers.dashboard.show.danger.delete.warning_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'developers.dashboard.show.danger.delete.warning_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="delete-confirm">
                                    {t(
                                        'developers.dashboard.show.danger.delete.confirm_label',
                                        { slug: app.slug },
                                    )}
                                </Label>
                                <Input
                                    id="delete-confirm"
                                    type="text"
                                    value={confirmation}
                                    onChange={(event) =>
                                        setConfirmation(event.target.value)
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="font-mono text-sm"
                                    disabled={processing}
                                />
                                <InputError
                                    message={
                                        confirmation.length > 0 && !canDelete
                                            ? t(
                                                  'developers.dashboard.show.danger.delete.mismatch',
                                              )
                                            : undefined
                                    }
                                />
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                    disabled={processing}
                                >
                                    {t('developers.form.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={!canDelete || processing}
                                    className="gap-2"
                                >
                                    <Trash2 className="size-4" aria-hidden />
                                    {t(
                                        'developers.dashboard.show.danger.delete.cta',
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            }
        />
    );
}

type DangerRowProps = {
    title: string;
    description: string;
    action: ReactNode;
};

function DangerRow({ title, description, action }: DangerRowProps) {
    return (
        <div className="flex flex-col gap-3 border-b border-border/60 py-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                <p className="text-sm font-semibold tracking-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">{action}</div>
        </div>
    );
}

type PanelProps = {
    title: string;
    description?: string;
    children: ReactNode;
    tone?: 'default' | 'danger';
};

function Panel({ title, description, children, tone = 'default' }: PanelProps) {
    return (
        <section
            className={cn(
                'space-y-4 rounded-2xl border bg-card p-6 shadow-sm',
                tone === 'danger'
                    ? 'border-destructive/30'
                    : 'border-border',
            )}
        >
            <div className="space-y-1">
                <h2
                    className={cn(
                        'text-base font-semibold tracking-tight',
                        tone === 'danger' && 'text-destructive',
                    )}
                >
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

type ProfileChipProps = {
    icon: typeof ShieldCheck;
    label: string;
    tone: 'primary' | 'muted';
};

function ProfileChip({ icon: Icon, label, tone }: ProfileChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wider',
                tone === 'primary'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            <Icon className="size-3.5" aria-hidden />
            {label}
        </span>
    );
}
