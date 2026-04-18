import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import { GoogleIcon } from '@/components/icons/google-icon';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import AuthLayout from '@/layouts/auth-layout';
import { login } from '@/routes';
import { show as legalShow } from '@/routes/legal';
import { store } from '@/routes/register';

export default function Register() {
    const { t } = useTranslation();
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [confirmAge, setConfirmAge] = useState(false);
    const consentReady = acceptTerms && confirmAge;

    return (
        <AuthLayout
            title={t('auth.register.title')}
            description={t('auth.register.description')}
        >
            <Head title={t('auth.register.title')} />
            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('auth.register.name')}</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="name"
                                    name="name"
                                    placeholder="Jane Doe"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">
                                    {t('profile.fields.username')}
                                </Label>
                                <Input
                                    id="username"
                                    type="text"
                                    required
                                    tabIndex={2}
                                    autoComplete="username"
                                    name="username"
                                    placeholder="jdoe"
                                />
                                <InputError message={errors.username} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">
                                    {t('auth.login.email')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    tabIndex={3}
                                    autoComplete="email"
                                    name="email"
                                    placeholder="correo@ejemplo.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="password">{t('auth.login.password')}</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        required
                                        tabIndex={4}
                                        autoComplete="new-password"
                                        name="password"
                                        placeholder="••••••••"
                                    />
                                    <InputError message={errors.password} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password_confirmation">
                                        Confirm
                                    </Label>
                                    <Input
                                        id="password_confirmation"
                                        type="password"
                                        required
                                        tabIndex={5}
                                        autoComplete="new-password"
                                        name="password_confirmation"
                                        placeholder="••••••••"
                                    />
                                    <InputError
                                        message={errors.password_confirmation}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="accept_terms"
                                        name="accept_terms"
                                        checked={acceptTerms}
                                        onCheckedChange={(value) => setAcceptTerms(value === true)}
                                        aria-invalid={!!errors.accept_terms}
                                        aria-describedby={errors.accept_terms ? 'accept_terms-error' : undefined}
                                        tabIndex={6}
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

                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="confirm_age"
                                        name="confirm_age"
                                        checked={confirmAge}
                                        onCheckedChange={(value) => setConfirmAge(value === true)}
                                        aria-invalid={!!errors.confirm_age}
                                        aria-describedby={errors.confirm_age ? 'confirm_age-error' : undefined}
                                        tabIndex={7}
                                        className="mt-0.5"
                                    />
                                    <div className="space-y-1">
                                        <Label
                                            htmlFor="confirm_age"
                                            className="text-sm leading-snug font-normal"
                                        >
                                            {t('auth.consent.age.label')}
                                        </Label>
                                        {errors.confirm_age && (
                                            <p
                                                id="confirm_age-error"
                                                className="text-xs text-destructive"
                                            >
                                                {errors.confirm_age}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            tabIndex={8}
                            disabled={!consentReady || processing}
                            data-test="register-user-button"
                        >
                            {processing && <Spinner />}
                            {t('auth.register.submit')}
                        </Button>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    {t('auth.login.or')}
                                </span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full transition-all duration-200 hover:shadow-md"
                            onClick={() =>
                                (window.location.href = '/auth/google/redirect')
                            }
                            tabIndex={9}
                        >
                            <GoogleIcon className="mr-2 size-4" />
                            {t('auth.login.google')}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            {t('auth.register.has_account')}{' '}
                            <TextLink href={login()} tabIndex={10}>
                                {t('auth.register.login')}
                            </TextLink>
                        </p>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
