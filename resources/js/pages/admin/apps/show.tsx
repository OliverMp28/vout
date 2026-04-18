import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Crown,
    ExternalLink,
    Globe,
    ShieldCheck,
    ShieldOff,
    Sparkles,
    User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
    DeleteAction,
    FirstPartyAction,
    ReactivateAction,
    SuspendAction,
} from '@/components/admin/apps/app-actions';
import { MetaRow, Panel } from '@/components/admin/panel';
import { CopyButton } from '@/components/developers/copy-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

AdminAppsShow.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;

// ── Info Panels ──────────────────────────────────────────────────────

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
                            label={t('admin.apps.show.details.client_type')}
                            value={
                                client.confidential
                                    ? t('admin.apps.show.details.confidential')
                                    : t('admin.apps.show.details.public')
                            }
                        />
                        <MetaRow
                            label={t('admin.apps.show.details.client_status')}
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

// ── Action Panels ────────────────────────────────────────────────────

function ActionsPanel({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.apps.show.actions.heading')} tone="danger">
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

// ── Helpers ──────────────────────────────────────────────────────────

type ProfileChipProps = {
    icon: typeof ShieldCheck;
    label: string;
    tone: 'primary' | 'muted';
};

function ProfileChip({ icon: Icon, label, tone }: ProfileChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium tracking-wider uppercase',
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
