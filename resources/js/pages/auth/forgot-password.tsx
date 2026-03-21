import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({ status }: { status?: string }) {
    return (
        <AuthLayout
            title="Recuperar contraseña"
            description="Introduce tu correo y te enviaremos un enlace para restablecerla"
        >
            <Head title="Recuperar contraseña" />

            {status && (
                <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    {status}
                </div>
            )}

            <div className="space-y-5">
                <Form {...email.form()}>
                    {({ processing, errors }) => (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">
                                    Correo electrónico
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="off"
                                    autoFocus
                                    placeholder="tu@correo.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <Button
                                className="w-full"
                                disabled={processing}
                                data-test="email-password-reset-link-button"
                            >
                                {processing && <Spinner />}
                                Enviar enlace de recuperación
                            </Button>
                        </div>
                    )}
                </Form>

                <p className="text-center text-sm text-muted-foreground">
                    <TextLink href={login()}>Volver a iniciar sesión</TextLink>
                </p>
            </div>
        </AuthLayout>
    );
}
