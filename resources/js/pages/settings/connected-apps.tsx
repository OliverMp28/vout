import { Form, Head, usePage } from '@inertiajs/react';
import { ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';
import ConnectedAppsController from '@/actions/App/Http/Controllers/Settings/ConnectedAppsController';
import { SectionPanel } from '@/components/section-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { index as connectedAppsIndex } from '@/routes/connected-apps';
import type { BreadcrumbItem } from '@/types';

type Scope = {
    readonly id: string;
    readonly description: string;
};

type Grant = {
    readonly id: string;
    readonly app: {
        readonly name: string | null;
        readonly app_url: string | null;
    };
    readonly scopes: readonly Scope[];
    readonly granted_at: string | null;
    readonly updated_scopes_at: string | null;
};

type Props = {
    readonly grants: readonly Grant[];
};

function formatDate(iso: string | null, locale: string): string {
    if (!iso) {
        return '';
    }
    try {
        return new Date(iso).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return iso;
    }
}

export default function ConnectedApps({ grants }: Props) {
    const { t } = useTranslation();
    const { locale } = usePage<{ locale: string }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('connected_apps.title'),
            href: connectedAppsIndex(),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('connected_apps.title')} />

            <h1 className="sr-only">{t('connected_apps.title')}</h1>

            <SettingsLayout>
                <SectionPanel
                    title={t('connected_apps.title')}
                    description={t('connected_apps.description')}
                >
                    {grants.length === 0 ? (
                        <div
                            className="flex flex-col items-center gap-2 rounded-surface border border-dashed border-border-strong px-6 py-10 text-center"
                            data-test="connected-apps-empty"
                        >
                            <ShieldCheck
                                className="size-8 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p className="font-semibold">
                                {t('connected_apps.empty_title')}
                            </p>
                            <p className="max-w-sm text-sm text-muted-foreground">
                                {t('connected_apps.empty_body')}
                            </p>
                        </div>
                    ) : (
                        <ul
                            className="divide-y"
                            data-test="connected-apps-list"
                        >
                            {grants.map((grant) => {
                                const appName =
                                    grant.app.name ?? 'OAuth client';

                                return (
                                    <li
                                        key={grant.id}
                                        className="grid gap-4 py-5 first:pt-0 last:pb-0"
                                        data-test={`connected-apps-item-${grant.id}`}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <span
                                                    aria-hidden="true"
                                                    className="flex size-10 shrink-0 items-center justify-center rounded-control border border-border-strong bg-key-light font-pixel text-xl leading-none shadow-[0_2px_0_0_var(--key-light-edge)]"
                                                >
                                                    {appName.charAt(0)}
                                                </span>
                                                <div className="min-w-0 space-y-0.5">
                                                    <p className="font-bold">
                                                        {appName}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {t(
                                                            'connected_apps.granted_at',
                                                            {
                                                                date: formatDate(
                                                                    grant.granted_at,
                                                                    locale,
                                                                ),
                                                            },
                                                        )}
                                                    </p>
                                                    {grant.app.app_url && (
                                                        <a
                                                            href={
                                                                grant.app
                                                                    .app_url
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 rounded-xs text-sm font-semibold underline decoration-border-strong underline-offset-4 hover:decoration-signal-strong"
                                                        >
                                                            {t(
                                                                'connected_apps.visit_app',
                                                            )}
                                                            <ExternalLink
                                                                className="size-3.5"
                                                                aria-hidden="true"
                                                            />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        data-test={`revoke-grant-${grant.id}`}
                                                    >
                                                        <Trash2
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                        {t(
                                                            'connected_apps.revoke_button',
                                                        )}
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogTitle>
                                                        {t(
                                                            'connected_apps.revoke_confirm_title',
                                                            { app: appName },
                                                        )}
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        {t(
                                                            'connected_apps.revoke_confirm_description',
                                                        )}
                                                    </DialogDescription>

                                                    <Form
                                                        {...ConnectedAppsController.destroy.form(
                                                            grant.id,
                                                        )}
                                                        options={{
                                                            preserveScroll: true,
                                                        }}
                                                    >
                                                        {({ processing }) => (
                                                            <DialogFooter className="gap-2">
                                                                <DialogClose
                                                                    asChild
                                                                >
                                                                    <Button variant="secondary">
                                                                        {t(
                                                                            'connected_apps.revoke_confirm_cancel',
                                                                        )}
                                                                    </Button>
                                                                </DialogClose>
                                                                <Button
                                                                    variant="destructive"
                                                                    disabled={
                                                                        processing
                                                                    }
                                                                    type="submit"
                                                                    data-test={`revoke-grant-confirm-${grant.id}`}
                                                                >
                                                                    {t(
                                                                        'connected_apps.revoke_confirm_action',
                                                                    )}
                                                                </Button>
                                                            </DialogFooter>
                                                        )}
                                                    </Form>
                                                </DialogContent>
                                            </Dialog>
                                        </div>

                                        <div className="space-y-2 sm:pl-13">
                                            <p className="font-pixel-label text-base leading-none text-muted-foreground">
                                                {t(
                                                    'connected_apps.scopes_label',
                                                )}
                                            </p>
                                            <ul className="flex flex-wrap gap-2">
                                                {grant.scopes.map((scope) => (
                                                    <li key={scope.id}>
                                                        <Badge variant="secondary">
                                                            {scope.description}
                                                        </Badge>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SectionPanel>
            </SettingsLayout>
        </AppLayout>
    );
}
