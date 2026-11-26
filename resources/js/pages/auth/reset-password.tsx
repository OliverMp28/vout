import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordHint, { usePasswordHintId } from '@/components/password-hint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import AuthLayout from '@/layouts/auth-layout';
import { update } from '@/routes/password';

type Props = {
    token: string;
    email: string;
};

export default function ResetPassword({ token, email }: Props) {
    const { t } = useTranslation();
    const passwordHintId = usePasswordHintId('password-hint');

    return (
        <AuthLayout
            title={t('auth.reset.title')}
            description={t('auth.reset.description')}
        >
            <Head title={t('auth.reset.title')} />

            <Form
                {...update.form()}
                transform={(data) => ({ ...data, token, email })}
                resetOnSuccess={['password', 'password_confirmation']}
            >
                {({ processing, errors, clearErrors }) => (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">
                                {t('auth.login.email')}
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                value={email}
                                className="text-muted-foreground"
                                readOnly
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">
                                {t('auth.reset.password')}
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                name="password"
                                autoComplete="new-password"
                                autoFocus
                                placeholder="••••••••"
                                aria-describedby={passwordHintId}
                                onChange={() => clearErrors('password')}
                            />
                            <PasswordHint id="password-hint" />
                            <InputError message={errors.password} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password_confirmation">
                                {t('auth.reset.password_confirm')}
                            </Label>
                            <Input
                                id="password_confirmation"
                                type="password"
                                name="password_confirmation"
                                autoComplete="new-password"
                                placeholder="••••••••"
                                onChange={() =>
                                    clearErrors(
                                        'password',
                                        'password_confirmation',
                                    )
                                }
                            />
                            <InputError
                                message={errors.password_confirmation}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={processing}
                            data-test="reset-password-button"
                        >
                            {processing && <Spinner />}
                            {t('auth.reset.submit')}
                        </Button>
                    </div>
                )}
            </Form>
        </AuthLayout>
    );
}
