import { Head, Link, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Ban,
    CheckCircle2,
    Crown,
    ExternalLink,
    Globe,
    Play,
    ShieldCheck,
    ShieldOff,
    Sparkles,
    Trash2,
    User,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CopyButton } from '@/components/developers/copy-button';
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
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import admin from '@/routes/admin';
import type { AdminAppClient, AdminAppDetail } from '@/types';

const { apps: appsRoutes } = admin;

type Props = {
    app: AdminAppDetail;
    client: AdminAppClient | null;
};

export default function AdminAppsShow({ app, client }: Props) {
    const { t } = useTranslation();

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
                        <Link href={appsRoutes.index().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('admin.apps.show.back')}
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                                    {app.name}
                                </h1>
                                <StatusBadge status={app.effective_status} />
                                {app.is_first_party && (
                                    <Crown
                                        className="size-4 text-amber-500"
                                        aria-label={t(
                                            'admin.apps.badge.first_party',
                                        )}
                                    />
                                )}
                            </div>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                                {app.slug}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {app.requires_auth ? (
                                <ProfileChip
                                    icon={ShieldCheck}
                                    label={t('admin.apps.show.auth_idp')}
                                    tone="primary"
                                />
                            ) : (
                                <ProfileChip
                                    icon={Sparkles}
                                    label={t('admin.apps.show.auth_client')}
                                    tone="muted"
                                />
                            )}
                        </div>
                    </div>
                </header>

                {app.suspended_at && (
                    <Alert
                        variant="destructive"
                        className="border-destructive/40"
                    >
                        <ShieldOff className="size-4" />
                        <AlertTitle>
                            {t('admin.apps.show.suspended_banner.title')}
                        </AlertTitle>
                        <AlertDescription>
                            {app.suspension_reason}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <DetailsPanel app={app} client={client} />
                        <OriginsPanel app={app} />
                    </div>
                    <div className="space-y-6">
                        <OwnerPanel app={app} />
                        <ActionsPanel app={app} />
                    </div>
                </div>
            </div>
        </>
    );
}

AdminAppsShow.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);

// ── Sub-components ─────────────────────────────────────────────────────

function StatusBadge({
    status,
}: {
    status: AdminAppDetail['effective_status'];
}) {
    const { t } = useTranslation();

    const config = {
        active: {
            variant: 'default' as const,
            className:
                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            label: t('admin.apps.status.active'),
        },
        paused: {
            variant: 'secondary' as const,
            className: '',
            label: t('admin.apps.status.paused'),
        },
        suspended: {
            variant: 'destructive' as const,
            className: '',
            label: t('admin.apps.status.suspended'),
        },
    };

    const { variant, className, label } = config[status];

    return (
        <Badge variant={variant} className={cn('text-[10px]', className)}>
            {status === 'suspended' && (
                <ShieldOff className="mr-1 size-3" aria-hidden />
            )}
            {label}
        </Badge>
    );
}

function DetailsPanel({
    app,
    client,
}: {
    app: AdminAppDetail;
    client: AdminAppClient | null;
}) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.apps.show.details.heading')}>
            <dl className="grid gap-4 sm:grid-cols-2">
                <MetaRow
                    label={t('admin.apps.show.details.name')}
                    value={app.name}
                />
                <MetaRow
                    label={t('admin.apps.show.details.slug')}
                    value={app.slug}
                    monospace
                />
                <div className="space-y-1 sm:col-span-2">
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {t('admin.apps.show.details.app_url')}
                    </dt>
                    <dd className="flex items-center gap-2 font-mono text-xs break-all">
                        {app.app_url}
                        <a
                            href={app.app_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ExternalLink className="size-3.5" aria-hidden />
                            <span className="sr-only">
                                {t('admin.apps.show.details.open_url')}
                            </span>
                        </a>
                    </dd>
                </div>
                {client && (
                    <>
                        <div className="space-y-1 sm:col-span-2">
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('admin.apps.show.details.client_id')}
                            </dt>
                            <dd className="flex items-center gap-2">
                                <code className="overflow-x-auto font-mono text-xs break-all">
                                    {client.id}
                                </code>
                                <CopyButton
                                    value={client.id}
                                    label={t('admin.apps.show.details.copy')}
                                />
                            </dd>
                        </div>
                        <MetaRow
                            label={t(
                                'admin.apps.show.details.client_type',
                            )}
                            value={
                                client.confidential
                                    ? t(
                                          'admin.apps.show.details.confidential',
                                      )
                                    : t('admin.apps.show.details.public')
                            }
                        />
                        <MetaRow
                            label={t(
                                'admin.apps.show.details.client_status',
                            )}
                            value={
                                client.revoked
                                    ? t('admin.apps.show.details.revoked')
                                    : t('admin.apps.show.details.valid')
                            }
                        />
                    </>
                )}
                {!client && app.requires_auth && (
                    <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground italic">
                            {t('admin.apps.show.details.no_client')}
                        </p>
                    </div>
                )}
                <MetaRow
                    label={t('admin.apps.show.details.created_at')}
                    value={new Date(app.created_at).toLocaleString()}
                />
                <MetaRow
                    label={t('admin.apps.show.details.updated_at')}
                    value={new Date(app.updated_at).toLocaleString()}
                />
            </dl>
        </Panel>
    );
}

function OriginsPanel({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.apps.show.origins.heading')}>
            {app.allowed_origins.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                    {t('admin.apps.show.origins.empty')}
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {app.allowed_origins.map((origin) => (
                        <li
                            key={origin}
                            className="flex items-center gap-2 text-sm"
                        >
                            <Globe
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                            />
                            <code className="font-mono text-xs break-all">
                                {origin}
                            </code>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function OwnerPanel({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.apps.show.owner.heading')}>
            {app.owner ? (
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User
                            className="size-5 text-muted-foreground"
                            aria-hidden
                        />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium">
                            {app.owner.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {app.owner.email}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                            @{app.owner.username}
                        </p>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground italic">
                    {t('admin.apps.show.owner.none')}
                </p>
            )}
        </Panel>
    );
}

function ActionsPanel({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();

    return (
        <Panel
            title={t('admin.apps.show.actions.heading')}
            tone="danger"
        >
            <FirstPartyAction app={app} />
            {app.suspended_at ? (
                <ReactivateAction app={app} />
            ) : (
                <SuspendAction app={app} />
            )}
            <DeleteAction app={app} />
        </Panel>
    );
}

function FirstPartyAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const { post, processing } = useForm({});

    const handleToggle = (): void => {
        post(appsRoutes.firstParty(app.slug).url, {
            preserveScroll: true,
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.first_party.title')}
            description={t(
                'admin.apps.show.actions.first_party.description',
            )}
            action={
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={processing}
                    className="gap-2"
                >
                    <Crown
                        className={cn(
                            'size-4',
                            app.is_first_party && 'text-amber-500',
                        )}
                        aria-hidden
                    />
                    {app.is_first_party
                        ? t(
                              'admin.apps.show.actions.first_party.remove',
                          )
                        : t('admin.apps.show.actions.first_party.mark')}
                </Button>
            }
        />
    );
}

function SuspendAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        remark: '',
    });

    const handleSuspend = (): void => {
        post(appsRoutes.suspend(app.slug).url, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.suspend.title')}
            description={t(
                'admin.apps.show.actions.suspend.description',
            )}
            action={
                <>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            reset();
                            setOpen(true);
                        }}
                        className="gap-2"
                    >
                        <Ban className="size-4" aria-hidden />
                        {t('admin.apps.show.actions.suspend.cta')}
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
                                        'admin.apps.show.actions.suspend.confirm_title',
                                        { name: app.name },
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'admin.apps.show.actions.suspend.confirm_body',
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <Alert
                                variant="destructive"
                                className="border-destructive/40"
                            >
                                <AlertTriangle className="size-4" />
                                <AlertTitle>
                                    {t(
                                        'admin.apps.show.actions.suspend.warning_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'admin.apps.show.actions.suspend.warning_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="suspend-remark">
                                    {t(
                                        'admin.apps.show.actions.suspend.remark_label',
                                    )}
                                </Label>
                                <Textarea
                                    id="suspend-remark"
                                    value={data.remark}
                                    onChange={(e) =>
                                        setData('remark', e.target.value)
                                    }
                                    placeholder={t(
                                        'admin.apps.show.actions.suspend.remark_placeholder',
                                    )}
                                    rows={3}
                                    disabled={processing}
                                />
                                <InputError message={errors.remark} />
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                    disabled={processing}
                                >
                                    {t('admin.apps.show.actions.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleSuspend}
                                    disabled={
                                        processing ||
                                        data.remark.length < 10
                                    }
                                    className="gap-2"
                                >
                                    <Ban className="size-4" aria-hidden />
                                    {t(
                                        'admin.apps.show.actions.suspend.cta',
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

function ReactivateAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const { post, processing } = useForm({});

    const handleReactivate = (): void => {
        post(appsRoutes.reactivate(app.slug).url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.reactivate.title')}
            description={t(
                'admin.apps.show.actions.reactivate.description',
            )}
            action={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(true)}
                        className="gap-2"
                    >
                        <Play className="size-4" aria-hidden />
                        {t('admin.apps.show.actions.reactivate.cta')}
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
                                        'admin.apps.show.actions.reactivate.confirm_title',
                                        { name: app.name },
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'admin.apps.show.actions.reactivate.confirm_body',
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <Alert
                                variant="default"
                                className="border-amber-500/40"
                            >
                                <CheckCircle2 className="size-4 text-amber-500" />
                                <AlertTitle>
                                    {t(
                                        'admin.apps.show.actions.reactivate.note_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'admin.apps.show.actions.reactivate.note_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                    disabled={processing}
                                >
                                    {t('admin.apps.show.actions.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleReactivate}
                                    disabled={processing}
                                    className="gap-2"
                                >
                                    <Play
                                        className="size-4"
                                        aria-hidden
                                    />
                                    {t(
                                        'admin.apps.show.actions.reactivate.cta',
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

function DeleteAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');

    const { delete: destroy, processing } = useForm({});

    const canDelete = confirmation === app.slug;

    const handleDelete = (): void => {
        if (!canDelete) return;

        destroy(appsRoutes.destroy(app.slug).url, {
            preserveScroll: false,
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.delete.title')}
            description={t(
                'admin.apps.show.actions.delete.description',
            )}
            action={
                <>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            setConfirmation('');
                            setOpen(true);
                        }}
                        disabled={processing}
                        className="gap-2"
                    >
                        <Trash2 className="size-4" aria-hidden />
                        {t('admin.apps.show.actions.delete.cta')}
                    </Button>

                    <Dialog
                        open={open}
                        onOpenChange={(next) => {
                            if (!processing) setOpen(next);
                        }}
                    >
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>
                                    {t(
                                        'admin.apps.show.actions.delete.confirm_title',
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'admin.apps.show.actions.delete.confirm_body',
                                        { slug: app.slug },
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <Alert
                                variant="destructive"
                                className="border-destructive/40"
                            >
                                <AlertTriangle className="size-4" />
                                <AlertTitle>
                                    {t(
                                        'admin.apps.show.actions.delete.warning_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'admin.apps.show.actions.delete.warning_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="delete-confirm">
                                    {t(
                                        'admin.apps.show.actions.delete.confirm_label',
                                        { slug: app.slug },
                                    )}
                                </Label>
                                <Input
                                    id="delete-confirm"
                                    type="text"
                                    value={confirmation}
                                    onChange={(e) =>
                                        setConfirmation(e.target.value)
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
                                                  'admin.apps.show.actions.delete.mismatch',
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
                                    {t('admin.apps.show.actions.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={!canDelete || processing}
                                    className="gap-2"
                                >
                                    <Trash2
                                        className="size-4"
                                        aria-hidden
                                    />
                                    {t(
                                        'admin.apps.show.actions.delete.cta',
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

// ── Shared layout pieces ───────────────────────────────────────────────

type PanelProps = {
    title: string;
    children: ReactNode;
    tone?: 'default' | 'danger';
};

function Panel({ title, children, tone = 'default' }: PanelProps) {
    return (
        <section
            className={cn(
                'space-y-4 rounded-2xl border bg-card p-6 shadow-sm',
                tone === 'danger' ? 'border-destructive/30' : 'border-border',
            )}
        >
            <h2
                className={cn(
                    'text-base font-semibold tracking-tight',
                    tone === 'danger' && 'text-destructive',
                )}
            >
                {title}
            </h2>
            <div className="space-y-4">{children}</div>
        </section>
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

type ActionRowProps = {
    title: string;
    description: string;
    action: ReactNode;
};

function ActionRow({ title, description, action }: ActionRowProps) {
    return (
        <div className="flex flex-col gap-3 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                <p className="text-sm font-semibold tracking-tight">
                    {title}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">{action}</div>
        </div>
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
