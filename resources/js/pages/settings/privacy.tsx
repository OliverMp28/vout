import { Form, Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Cookie,
    Download,
    FileText,
    ShieldCheck,
} from 'lucide-react';
import { useRef, useState } from 'react';
import PrivacyController from '@/actions/App/Http/Controllers/Settings/PrivacyController';
import { CookiePreferencesDialog } from '@/components/cookie-consent/cookie-preferences-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { show as legalShow } from '@/routes/legal';
import { edit as editPrivacy, exportMethod } from '@/routes/privacy';
import type { BreadcrumbItem } from '@/types';

type Props = {
    readonly consent: {
        readonly terms_accepted_at: string | null;
        readonly privacy_version_accepted: string | null;
        readonly current_privacy_version: string;
        readonly needs_reacceptance: boolean;
    };
    readonly has_password: boolean;
};

export default function Privacy({ consent, has_password }: Props) {
    const { t } = useTranslation();
    const { locale } = usePage<{ locale: string }>().props;
    const passwordInput = useRef<HTMLInputElement>(null);
    const [cookiesOpen, setCookiesOpen] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('privacy.title'),
            href: editPrivacy(),
        },
    ];

    const acceptedDate = consent.terms_accepted_at
        ? new Date(consent.terms_accepted_at).toLocaleDateString(locale ?? 'es', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('privacy.title')} />

            <h1 className="sr-only">{t('privacy.title')}</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    {/* Consent status */}
                    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 rounded-lg bg-primary/10 p-3">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                                <Heading
                                    variant="small"
                                    title={t('privacy.consent.title')}
                                    description={t('privacy.consent.desc')}
                                />

                                <dl className="mt-4 space-y-3 text-sm">
                                    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3">
                                        <dt className="text-muted-foreground">
                                            {t('privacy.consent.accepted_on')}
                                        </dt>
                                        <dd className="text-right font-medium">
                                            {acceptedDate ?? (
                                                <span className="text-muted-foreground">
                                                    {t('privacy.consent.unknown')}
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3">
                                        <dt className="text-muted-foreground">
                                            {t('privacy.consent.version')}
                                        </dt>
                                        <dd className="text-right">
                                            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                                                {consent.privacy_version_accepted ??
                                                    '—'}
                                            </code>
                                            {consent.privacy_version_accepted !==
                                                consent.current_privacy_version && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    {t('privacy.consent.current')}:{' '}
                                                    <code className="rounded bg-muted px-2 py-0.5 font-mono">
                                                        {
                                                            consent.current_privacy_version
                                                        }
                                                    </code>
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                </dl>

                                {consent.needs_reacceptance && (
                                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-200">
                                        <AlertTriangle
                                            className="mt-0.5 size-4 shrink-0"
                                            aria-hidden="true"
                                        />
                                        <p>{t('privacy.consent.reaccept_warn')}</p>
                                    </div>
                                )}

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                    >
                                        <Link
                                            href={legalShow('privacidad').url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <FileText
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {t('privacy.consent.read_privacy')}
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                    >
                                        <Link
                                            href={legalShow('terminos').url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <FileText
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {t('privacy.consent.read_terms')}
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Export data (portabilidad RGPD art. 20) */}
                    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 rounded-lg bg-blue-500/10 p-3">
                                <Download className="h-6 w-6 text-blue-500" />
                            </div>
                            <div className="flex-1">
                                <Heading
                                    variant="small"
                                    title={t('privacy.export.title')}
                                    description={t('privacy.export.desc')}
                                />
                                <p className="mt-3 text-xs text-muted-foreground">
                                    {t('privacy.export.hint')}
                                </p>
                                <div className="mt-4">
                                    <Button asChild>
                                        <a
                                            href={exportMethod().url}
                                            download
                                            data-test="export-data-button"
                                        >
                                            <Download
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {t('privacy.export.cta')}
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Cookies */}
                    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 rounded-lg bg-amber-500/10 p-3">
                                <Cookie className="h-6 w-6 text-amber-500" />
                            </div>
                            <div className="flex-1">
                                <Heading
                                    variant="small"
                                    title={t('privacy.cookies.title')}
                                    description={t('privacy.cookies.desc')}
                                />
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setCookiesOpen(true)}
                                    >
                                        <Cookie
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {t('privacy.cookies.cta')}
                                    </Button>
                                    <Button asChild variant="ghost">
                                        <Link
                                            href={legalShow('cookies').url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {t('privacy.cookies.read_policy')}
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Delete account (RGPD art. 17) */}
                    <section className="rounded-xl border border-red-200/60 bg-red-50/40 p-6 shadow-sm dark:border-red-500/20 dark:bg-red-500/5 md:p-8">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 rounded-lg bg-red-500/10 p-3">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <Heading
                                    variant="small"
                                    title={t('privacy.delete.title')}
                                    description={t('privacy.delete.desc')}
                                />

                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2
                                            className="mt-0.5 size-4 shrink-0 text-red-500"
                                            aria-hidden="true"
                                        />
                                        <span>{t('privacy.delete.what_erased')}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2
                                            className="mt-0.5 size-4 shrink-0 text-amber-500"
                                            aria-hidden="true"
                                        />
                                        <span>
                                            {t('privacy.delete.what_anonymized')}
                                        </span>
                                    </li>
                                </ul>

                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-200">
                                    {t('privacy.delete.export_first')}
                                </div>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            disabled={!has_password}
                                            data-test="delete-user-button"
                                        >
                                            <AlertTriangle
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {t('privacy.delete.cta')}
                                        </Button>
                                    </DialogTrigger>
                                    {!has_password && (
                                        <p className="text-xs text-muted-foreground">
                                            {t('privacy.delete.no_password')}
                                        </p>
                                    )}
                                    <DialogContent>
                                        <DialogTitle>
                                            {t('privacy.delete.confirm_title')}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {t('privacy.delete.confirm_desc')}
                                        </DialogDescription>

                                        <Form
                                            {...PrivacyController.destroy.form()}
                                            options={{
                                                preserveScroll: true,
                                            }}
                                            onError={() =>
                                                passwordInput.current?.focus()
                                            }
                                            resetOnSuccess
                                            className="space-y-6"
                                        >
                                            {({
                                                resetAndClearErrors,
                                                processing,
                                                errors,
                                            }) => (
                                                <>
                                                    <div className="grid gap-2">
                                                        <Label
                                                            htmlFor="delete-password"
                                                            className="sr-only"
                                                        >
                                                            {t(
                                                                'privacy.delete.password_label',
                                                            )}
                                                        </Label>
                                                        <Input
                                                            id="delete-password"
                                                            type="password"
                                                            name="password"
                                                            ref={passwordInput}
                                                            placeholder={t(
                                                                'privacy.delete.password_label',
                                                            )}
                                                            autoComplete="current-password"
                                                            aria-invalid={
                                                                !!errors.password
                                                            }
                                                        />
                                                        <InputError
                                                            message={
                                                                errors.password
                                                            }
                                                        />
                                                    </div>

                                                    <DialogFooter className="gap-2">
                                                        <DialogClose asChild>
                                                            <Button
                                                                variant="secondary"
                                                                onClick={() =>
                                                                    resetAndClearErrors()
                                                                }
                                                            >
                                                                {t(
                                                                    'privacy.delete.cancel',
                                                                )}
                                                            </Button>
                                                        </DialogClose>
                                                        <Button
                                                            variant="destructive"
                                                            disabled={processing}
                                                            asChild
                                                        >
                                                            <button
                                                                type="submit"
                                                                data-test="confirm-delete-user-button"
                                                            >
                                                                {t(
                                                                    'privacy.delete.submit',
                                                                )}
                                                            </button>
                                                        </Button>
                                                    </DialogFooter>
                                                </>
                                            )}
                                        </Form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </section>
                </div>

                <CookiePreferencesDialog
                    open={cookiesOpen}
                    onOpenChange={setCookiesOpen}
                />
            </SettingsLayout>
        </AppLayout>
    );
}
