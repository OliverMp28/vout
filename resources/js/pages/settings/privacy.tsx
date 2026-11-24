import { Form, Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Cookie,
    Download,
    FileText,
    Trash2,
    UserX,
} from 'lucide-react';
import { useRef, useState } from 'react';
import PrivacyController from '@/actions/App/Http/Controllers/Settings/PrivacyController';
import { CookiePreferencesDialog } from '@/components/cookie-consent/cookie-preferences-dialog';
import InputError from '@/components/input-error';
import { SectionPanel } from '@/components/section-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useMascotContext } from '@/hooks/use-mascot-context';
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

    // Si hay que re-aceptar una nueva política, Vou lo avisa
    // proactivamente (urgente). Sin eso, tip informativo sobre el
    // derecho de exportación/borrado.
    useMascotContext([
        {
            id: 'settings.privacy.reaccept',
            priority: 30,
            auto: true,
            tone: 'info',
            when: consent.needs_reacceptance,
            text: t('mascot.context.settings.privacy.reaccept'),
        },
        {
            id: 'settings.privacy.your_data',
            priority: 10,
            when: true,
            text: t('mascot.context.settings.privacy.your_data'),
        },
    ]);

    const acceptedDate = consent.terms_accepted_at
        ? new Date(consent.terms_accepted_at).toLocaleDateString(
              locale ?? 'es',
              {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
              },
          )
        : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('privacy.title')} />

            <h1 className="sr-only">{t('privacy.title')}</h1>

            <SettingsLayout>
                {/* Consentimiento */}
                <SectionPanel
                    title={t('privacy.consent.title')}
                    description={t('privacy.consent.desc')}
                >
                    <dl className="space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4 border-b pb-3">
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
                        <div className="flex items-start justify-between gap-4 border-b pb-3">
                            <dt className="text-muted-foreground">
                                {t('privacy.consent.version')}
                            </dt>
                            <dd className="text-right">
                                <code className="rounded-xs border bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">
                                    {consent.privacy_version_accepted ?? '—'}
                                </code>
                                {consent.privacy_version_accepted !==
                                    consent.current_privacy_version && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {t('privacy.consent.current')}:{' '}
                                        <code className="rounded-xs border bg-surface-sunken px-1.5 py-0.5 font-mono">
                                            {consent.current_privacy_version}
                                        </code>
                                    </span>
                                )}
                            </dd>
                        </div>
                    </dl>

                    {consent.needs_reacceptance && (
                        <Alert variant="warning" className="mt-4">
                            <AlertTriangle aria-hidden="true" />
                            <AlertDescription>
                                {t('privacy.consent.reaccept_warn')}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
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
                        <Button asChild variant="outline" size="sm">
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
                </SectionPanel>

                {/* Exportar los datos (portabilidad, RGPD art. 20) */}
                <SectionPanel
                    title={t('privacy.export.title')}
                    description={t('privacy.export.desc')}
                >
                    <p className="text-sm text-muted-foreground">
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
                </SectionPanel>

                {/* Cookies */}
                <SectionPanel
                    title={t('privacy.cookies.title')}
                    description={t('privacy.cookies.desc')}
                >
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setCookiesOpen(true)}
                        >
                            <Cookie className="size-4" aria-hidden="true" />
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
                </SectionPanel>

                {/* Borrar la cuenta (RGPD art. 17) */}
                <SectionPanel
                    tone="danger"
                    title={t('privacy.delete.title')}
                    description={t('privacy.delete.desc')}
                >
                    <div className="space-y-4">
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                                <Trash2
                                    className="mt-0.5 size-4 shrink-0 text-danger-text"
                                    aria-hidden="true"
                                />
                                <span>{t('privacy.delete.what_erased')}</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <UserX
                                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <span>
                                    {t('privacy.delete.what_anonymized')}
                                </span>
                            </li>
                        </ul>

                        <p className="text-sm text-muted-foreground">
                            {t('privacy.delete.export_first')}
                        </p>

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
                                                    message={errors.password}
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
                </SectionPanel>

                <CookiePreferencesDialog
                    open={cookiesOpen}
                    onOpenChange={setCookiesOpen}
                />
            </SettingsLayout>
        </AppLayout>
    );
}
