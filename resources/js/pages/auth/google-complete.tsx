import { Form, Head } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import AuthLayout from '@/layouts/auth-layout';
import { show as legalShow } from '@/routes/legal';

type Props = {
    name: string;
    email: string;
};

export default function GoogleComplete({ name, email }: Props) {
    const { t } = useTranslation();
    const [acceptTerms, setAcceptTerms] = useState(false);
    // Age-gate oculto por decisión de producto (proyecto personal, sin público masivo).
    // Backend + i18n siguen intactos — para reactivarlo basta con restaurar el bloque
    // del checkbox `confirm_age` más abajo y volver a `acceptTerms && confirmAge`.
    const consentReady = acceptTerms;

    return (
        <AuthLayout
            title={t('auth.google_complete.title')}
            description={t('auth.google_complete.description', { name })}
        >
            <Head title={t('auth.google_complete.title')} />

            <div className="space-y-6">
                <div className="flex justify-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                        <ShieldCheck className="size-8 text-primary" />
                    </div>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-center text-sm text-muted-foreground">
                    {t('auth.google_complete.connected_as')}{' '}
                    <span className="font-medium text-foreground">{email}</span>
                </div>

                <Form
                    action="/auth/google/complete"
                    method="post"
                    disableWhileProcessing
                    className="space-y-5"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="accept_terms"
                                        name="accept_terms"
                                        checked={acceptTerms}
                                        onCheckedChange={(value) => setAcceptTerms(value === true)}
                                        aria-invalid={!!errors.accept_terms}
                                        aria-describedby={errors.accept_terms ? 'accept_terms-error' : undefined}
                                        className="mt-0.5"
                                    />
                                    <div className="space-y-1">
                                        <Label
                                            htmlFor="accept_terms"
                                            className="text-sm leading-snug font-normal"
                                        >
                                            {t('auth.consent.terms.label_prefix')}{' '}
                                            <TextLink
                                                href={legalShow('terminos')}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {t('auth.consent.terms.link_terms')}
                                            </TextLink>
                                            {' '}{t('auth.consent.terms.label_and')}{' '}
                                            <TextLink
                                                href={legalShow('privacidad')}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {t('auth.consent.terms.link_privacy')}
                                            </TextLink>
                                            .
                                        </Label>
                                        {errors.accept_terms && (
                                            <p
                                                id="accept_terms-error"
                                                className="text-xs text-destructive"
                                            >
                                                {errors.accept_terms}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/*
                                    Age-gate (≥14) oculto por decisión de producto — ver google-complete.tsx:21.
                                    El backend sigue validando `confirm_age` así que enviamos un hidden
                                    para no romper el flujo. Para reactivar la UI: eliminar el hidden y
                                    restaurar el Checkbox siguiente.

                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="confirm_age"
                                            name="confirm_age"
                                            checked={confirmAge}
                                            onCheckedChange={(value) => setConfirmAge(value === true)}
                                            aria-invalid={!!errors.confirm_age}
                                            aria-describedby={errors.confirm_age ? 'confirm_age-error' : undefined}
                                            className="mt-0.5"
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="confirm_age" className="text-sm leading-snug font-normal">
                                                {t('auth.consent.age.label')}
                                            </Label>
                                            {errors.confirm_age && (
                                                <p id="confirm_age-error" className="text-xs text-destructive">
                                                    {errors.confirm_age}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                */}
                                <input type="hidden" name="confirm_age" value="1" />
                                <InputError message={errors.accept_terms} />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={!consentReady || processing}
                            >
                                {processing && <Spinner />}
                                {t('auth.google_complete.submit')}
                            </Button>
                        </>
                    )}
                </Form>

                <Form
                    action="/auth/google/cancel"
                    method="post"
                    className="text-center"
                >
                    {({ processing }) => (
                        <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={processing}
                            className="text-sm text-muted-foreground hover:text-foreground"
                        >
                            {processing && <Spinner />}
                            {t('auth.google_complete.cancel')}
                        </Button>
                    )}
                </Form>
            </div>
        </AuthLayout>
    );
}
