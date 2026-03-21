import { Form, Head } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <AuthLayout
            title="Verificar correo"
            description="Haz clic en el enlace que enviamos a tu correo para activar tu cuenta"
        >
            <Head title="Verificar correo" />

            <div className="space-y-6">
                {status === 'verification-link-sent' && (
                    <div className="rounded-md bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        Se ha enviado un nuevo enlace de verificación a tu
                        correo.
                    </div>
                )}

                <div className="flex justify-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                        <MailCheck className="size-8 text-primary" />
                    </div>
                </div>

                <Form {...send.form()} className="space-y-4 text-center">
                    {({ processing }) => (
                        <>
                            <Button
                                disabled={processing}
                                className="w-full"
                                variant="secondary"
                            >
                                {processing && <Spinner />}
                                Reenviar correo de verificación
                            </Button>

                            <TextLink
                                href={logout()}
                                className="block text-sm text-muted-foreground"
                            >
                                Cerrar sesión
                            </TextLink>
                        </>
                    )}
                </Form>
            </div>
        </AuthLayout>
    );
}
