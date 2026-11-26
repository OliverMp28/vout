import { Transition } from '@headlessui/react';
import { Form, Head, usePage } from '@inertiajs/react';
import { useRef } from 'react';
import PasswordController from '@/actions/App/Http/Controllers/Settings/PasswordController';
import InputError from '@/components/input-error';
import { CelebrateOnSuccess } from '@/components/mascot/celebrate-on-success';
import PasswordHint, { usePasswordHintId } from '@/components/password-hint';
import { SectionPanel } from '@/components/section-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMascotContext } from '@/hooks/use-mascot-context';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/user-password';
import type { BreadcrumbItem } from '@/types';

export default function Password() {
    const { auth } = usePage().props;
    const { t } = useTranslation();
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('password.title'),
            href: edit(),
        },
    ];
    const passwordInput = useRef<HTMLInputElement>(null);
    const passwordHintId = usePasswordHintId('password-hint');
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    // Un único mensaje: tip de seguridad. Es tap-only — el auto-show aquí
    // resultaría insistente (el usuario ya sabe a qué viene a esta pantalla).
    useMascotContext([
        {
            id: 'settings.password.tip',
            priority: 10,
            when: true,
            text: t('mascot.context.settings.password.tip'),
        },
    ]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('password.title')} />

            <h1 className="sr-only">{t('password.title')}</h1>

            <SettingsLayout>
                <SectionPanel
                    title={t('password.title')}
                    description={t('password.desc')}
                >
                    <Form
                        {...PasswordController.update.form()}
                        options={{
                            preserveScroll: true,
                        }}
                        resetOnError={[
                            'password',
                            'password_confirmation',
                            'current_password',
                        ]}
                        resetOnSuccess
                        onError={(errors) => {
                            if (errors.password) {
                                passwordInput.current?.focus();
                            }

                            if (errors.current_password) {
                                currentPasswordInput.current?.focus();
                            }
                        }}
                        className="space-y-6"
                    >
                        {({
                            errors,
                            processing,
                            recentlySuccessful,
                            clearErrors,
                        }) => (
                            <>
                                <CelebrateOnSuccess
                                    recentlySuccessful={recentlySuccessful}
                                />
                                <input
                                    type="text"
                                    name="username"
                                    autoComplete="username"
                                    defaultValue={auth?.user?.email ?? ''}
                                    readOnly
                                    tabIndex={-1}
                                    aria-hidden="true"
                                    className="sr-only"
                                />

                                <div className="grid gap-2">
                                    <Label htmlFor="current_password">
                                        {t('password.current')}
                                    </Label>

                                    <Input
                                        id="current_password"
                                        ref={currentPasswordInput}
                                        name="current_password"
                                        type="password"
                                        autoComplete="current-password"
                                    />

                                    <InputError
                                        message={errors.current_password}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password">
                                        {t('password.new')}
                                    </Label>

                                    <Input
                                        id="password"
                                        ref={passwordInput}
                                        name="password"
                                        type="password"
                                        autoComplete="new-password"
                                        aria-describedby={passwordHintId}
                                        onChange={() => clearErrors('password')}
                                    />

                                    <PasswordHint id="password-hint" />
                                    <InputError message={errors.password} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password_confirmation">
                                        {t('password.confirm')}
                                    </Label>

                                    <Input
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        type="password"
                                        autoComplete="new-password"
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

                                <div className="flex items-center gap-4 border-t pt-5">
                                    <Button
                                        disabled={processing}
                                        data-test="update-password-button"
                                    >
                                        {t('password.save')}
                                    </Button>

                                    <Transition
                                        show={recentlySuccessful}
                                        enter="transition-opacity ease-out"
                                        enterFrom="opacity-0"
                                        leave="transition-opacity ease-in"
                                        leaveTo="opacity-0"
                                    >
                                        <p
                                            role="status"
                                            className="text-sm font-medium text-success-text"
                                        >
                                            {t('password.saved')}
                                        </p>
                                    </Transition>
                                </div>
                            </>
                        )}
                    </Form>
                </SectionPanel>
            </SettingsLayout>
        </AppLayout>
    );
}
