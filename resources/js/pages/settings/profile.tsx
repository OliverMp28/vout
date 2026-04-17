import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { BreadcrumbItem } from '@/types';

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage().props;
    const { t } = useTranslation();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('profile.edit.title'),
            href: edit(),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('profile.edit.title')} />

            <h1 className="sr-only">{t('profile.edit.title')}</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <Heading
                            variant="small"
                            title={t('profile.info.title')}
                            description={t('profile.info.desc')}
                        />

                        <Form
                            {...ProfileController.update.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            encType="multipart/form-data"
                            className="mt-6 space-y-6"
                        >
                            {({ processing, recentlySuccessful, errors }) => (
                                <>
                                    <div className="flex flex-col gap-6 sm:flex-row">
                                        <div className="grid flex-1 gap-2">
                                            <Label htmlFor="avatar">
                                                {t('profile.fields.avatar')}
                                            </Label>
                                            <div className="flex items-center gap-4">
                                                {auth.user.avatar && (
                                                    <img
                                                        src={auth.user.avatar}
                                                        alt="Avatar"
                                                        className="h-16 w-16 rounded-full border-2 border-primary/20 object-cover"
                                                    />
                                                )}
                                                <div className="flex-1">
                                                    <Input
                                                        id="avatar"
                                                        type="file"
                                                        name="avatar"
                                                        className="block w-full cursor-pointer file:cursor-pointer"
                                                        accept="image/*"
                                                    />
                                                    <InputError
                                                        className="mt-2"
                                                        message={errors.avatar}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">
                                                {t('profile.fields.name')}
                                            </Label>
                                            <Input
                                                id="name"
                                                className="mt-1 block w-full bg-background/50"
                                                defaultValue={auth.user.name}
                                                name="name"
                                                required
                                                autoComplete="name"
                                                placeholder={t('profile.fields.name')}
                                            />
                                            <InputError
                                                className="mt-2"
                                                message={errors.name}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="username">
                                                {t('profile.fields.username')}
                                            </Label>
                                            <Input
                                                id="username"
                                                className="mt-1 block w-full bg-background/50"
                                                defaultValue={
                                                    auth.user.username
                                                }
                                                name="username"
                                                required
                                                autoComplete="username"
                                                placeholder={t('profile.fields.username')}
                                            />
                                            <InputError
                                                className="mt-2"
                                                message={errors.username}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="email">
                                            {t('profile.fields.email')}
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            className="mt-1 block w-full bg-background/50"
                                            defaultValue={auth.user.email}
                                            name="email"
                                            required
                                            autoComplete="email"
                                            placeholder={t('profile.fields.email')}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.email}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="bio">{t('profile.fields.bio')}</Label>
                                        <textarea
                                            id="bio"
                                            className="mt-1 block min-h-[100px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                            defaultValue={auth.user.bio || ''}
                                            name="bio"
                                            placeholder={t('profile.fields.bio_placeholder')}
                                        />
                                        <InputError
                                            className="mt-2"
                                            message={errors.bio}
                                        />
                                    </div>

                                    {mustVerifyEmail &&
                                        auth.user.email_verified_at ===
                                            null && (
                                            <div>
                                                <p className="-mt-4 text-sm text-muted-foreground">
                                                    Your email address is
                                                    unverified.{' '}
                                                    <Link
                                                        href={send()}
                                                        as="button"
                                                        className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                                    >
                                                        Click here to resend the
                                                        verification email.
                                                    </Link>
                                                </p>

                                                {status ===
                                                    'verification-link-sent' && (
                                                    <div className="mt-2 text-sm font-medium text-green-600">
                                                        A new verification link
                                                        has been sent to your
                                                        email address.
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    <div className="flex items-center gap-4">
                                        <Button
                                            disabled={processing}
                                            data-test="update-profile-button"
                                        >
                                            {t('profile.save')}
                                        </Button>

                                        <Transition
                                            show={recentlySuccessful}
                                            enter="transition ease-in-out"
                                            enterFrom="opacity-0"
                                            leave="transition ease-in-out"
                                            leaveTo="opacity-0"
                                        >
                                            <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                                {t('profile.saved')}
                                            </p>
                                        </Transition>
                                    </div>
                                </>
                            )}
                        </Form>
                    </div>

                    <div className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <Heading
                            variant="small"
                            title={t('profile.details.title')}
                            description={t('profile.details.desc')}
                        />
                        <div className="space-y-4">
                            <div className="flex flex-col items-start justify-between gap-4 border-b border-border/50 py-2 sm:flex-row sm:items-center">
                                <div>
                                    <p className="font-medium">
                                        Vout ID (Universal Identifier)
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Used across all games in the ecosystem
                                    </p>
                                </div>
                                <code className="rounded-md bg-muted px-3 py-1.5 text-center font-mono text-xs text-muted-foreground select-all">
                                    {auth.user.vout_id}
                                </code>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="font-medium">
                                        Google Linked Account
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Sign in securely with Google
                                    </p>
                                </div>
                                <div>
                                    {auth.user.google_id ? (
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex items-center rounded-md bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-500 ring-1 ring-green-500/20 ring-inset">
                                                Connected
                                            </span>
                                            {auth.user.has_password && (
                                                <Link
                                                    href="/settings/google"
                                                    method="delete"
                                                    as="button"
                                                    type="button"
                                                    className="text-xs text-red-500 transition-colors hover:text-red-600 hover:underline"
                                                >
                                                    Disconnect
                                                </Link>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center rounded-md bg-neutral-500/10 px-2.5 py-1 text-xs font-semibold text-neutral-500 ring-1 ring-neutral-500/20 ring-inset">
                                            Not Connected
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
