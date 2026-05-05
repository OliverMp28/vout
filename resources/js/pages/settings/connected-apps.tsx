import { Form, Head, usePage } from '@inertiajs/react';
import { ExternalLink, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import ConnectedAppsController from '@/actions/App/Http/Controllers/Settings/ConnectedAppsController';
import Heading from '@/components/heading';
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
                <div className="space-y-6">
                    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <Heading
                            title={t('connected_apps.title')}
                            description={t('connected_apps.description')}
                        />

                        {grants.length === 0 ? (
                            <div
                                className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 p-10 text-center"
                                data-test="connected-apps-empty"
                            >
                                <ShieldCheck
                                    className="size-10 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <p className="text-base font-medium">
                                    {t('connected_apps.empty_title')}
                                </p>
                                <p className="max-w-sm text-sm text-muted-foreground">
                                    {t('connected_apps.empty_body')}
                                </p>
                            </div>
                        ) : (
                            <ul
                                className="mt-6 space-y-4"
                                data-test="connected-apps-list"
                            >
                                {grants.map((grant) => (
                                    <li
                                        key={grant.id}
                                        className="rounded-lg border border-border/60 bg-background/60 p-5 transition-all duration-200 hover:shadow-md"
                                        data-test={`connected-apps-item-${grant.id}`}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                                                        <KeyRound
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                    </span>
                                                    <div>
                                                        <p className="text-base font-medium">
                                                            {grant.app.name ??
                                                                'OAuth client'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
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
                                                    </div>
                                                </div>

                                                {grant.app.app_url && (
                                                    <a
                                                        href={grant.app.app_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                                    >
                                                        <ExternalLink
                                                            className="size-3"
                                                            aria-hidden="true"
                                                        />
                                                        {t(
                                                            'connected_apps.visit_app',
                                                        )}
                                                    </a>
                                                )}
                                            </div>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="destructive"
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
                                                            {
                                                                app:
                                                                    grant.app
                                                                        .name ??
                                                                    'OAuth client',
                                                            },
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
                                                            preserveScroll:
                                                                true,
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

                                        <div className="mt-4 border-t border-border/40 pt-4">
                                            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                                {t(
                                                    'connected_apps.scopes_label',
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {grant.scopes.map((scope) => (
                                                    <Badge
                                                        key={scope.id}
                                                        variant="secondary"
                                                        className="font-normal"
                                                    >
                                                        {scope.description}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
