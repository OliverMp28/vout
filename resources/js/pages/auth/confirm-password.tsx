import { Form, Head, usePage } from '@inertiajs/react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { store } from '@/routes/password/confirm';

export default function ConfirmPassword() {
    const { auth } = usePage().props;

    const handleGoBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/settings/profile';
        }
    };

    return (
        <AuthLayout
            title="Confirmar contraseña"
            description="Esta es una zona segura. Confirma tu contraseña para continuar."
        >
            <Head title="Confirmar contraseña" />

            <div className="space-y-6">
                <div className="flex justify-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                        <ShieldCheck className="size-8 text-primary" />
                    </div>
                </div>

                <Form {...store.form()} resetOnSuccess={['password']}>
                    {({ processing, errors }) => (
                        <div className="space-y-4">
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

                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    name="password"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    autoFocus
                                />
                                <InputError message={errors.password} />
                            </div>

                            <Button
                                className="w-full"
                                disabled={processing}
                                data-test="confirm-password-button"
                            >
                                {processing && <Spinner />}
                                Confirmar contraseña
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-muted-foreground hover:text-foreground"
                                onClick={handleGoBack}
                                disabled={processing}
                            >
                                <ArrowLeft className="size-4" />
                                Cancelar y volver
                            </Button>
                        </div>
                    )}
                </Form>
            </div>
        </AuthLayout>
    );
}
