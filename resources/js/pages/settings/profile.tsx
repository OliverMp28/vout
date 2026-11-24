import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import { ImageUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import InputError from '@/components/input-error';
import { CelebrateOnSuccess } from '@/components/mascot/celebrate-on-success';
import { SectionPanel, SectionRow } from '@/components/section-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useInitials } from '@/hooks/use-initials';
import { useMascotContext } from '@/hooks/use-mascot-context';
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

    // ── Mensajes contextuales para Vou (S7) ────────────────────────────
    // Tres capas: verificación de email pendiente (urgente), invitación a
    // vincular Google si aún no lo está, y el tip informativo del Vout ID
    // como fallback. Los dos primeros se auto-muestran porque son
    // accionables.
    const emailUnverified =
        mustVerifyEmail && auth.user.email_verified_at === null;
    const googleLinked = auth.user.google_id !== null;

    useMascotContext([
        {
            id: 'settings.profile.verify_email',
            priority: 30,
            auto: true,
            tone: 'info',
            when: emailUnverified,
            text: t('mascot.context.settings.profile.verify_email'),
        },
        {
            id: 'settings.profile.link_google',
            priority: 20,
            auto: true,
            when: !googleLinked,
            text: t('mascot.context.settings.profile.link_google'),
        },
        {
            id: 'settings.profile.vout_id',
            priority: 10,
            when: true,
            text: t('mascot.context.settings.profile.vout_id'),
        },
    ]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('profile.edit.title')} />

            <h1 className="sr-only">{t('profile.edit.title')}</h1>

            <SettingsLayout>
                <SectionPanel
                    title={t('profile.info.title')}
                    description={t('profile.info.desc')}
                >
                    <Form
                        {...ProfileController.update.form()}
                        options={{
                            preserveScroll: true,
                        }}
                        encType="multipart/form-data"
                        className="space-y-6"
                    >
                        {({ processing, recentlySuccessful, errors }) => (
                            <>
                                <CelebrateOnSuccess
                                    recentlySuccessful={recentlySuccessful}
                                />

                                <AvatarPicker
                                    name={auth.user.name}
                                    current={auth.user.avatar}
                                    error={errors.avatar}
                                />

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">
                                            {t('profile.fields.name')}
                                        </Label>
                                        <Input
                                            id="name"
                                            defaultValue={auth.user.name}
                                            name="name"
                                            required
                                            autoComplete="name"
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="username">
                                            {t('profile.fields.username')}
                                        </Label>
                                        <Input
                                            id="username"
                                            defaultValue={auth.user.username}
                                            name="username"
                                            required
                                            autoComplete="username"
                                        />
                                        <InputError message={errors.username} />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">
                                        {t('profile.fields.email')}
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        defaultValue={auth.user.email}
                                        name="email"
                                        required
                                        autoComplete="email"
                                    />
                                    <InputError message={errors.email} />

                                    {emailUnverified && (
                                        <div className="space-y-1 text-sm text-muted-foreground">
                                            <p>
                                                {t('profile.email.unverified')}{' '}
                                                <Link
                                                    href={send()}
                                                    as="button"
                                                    className="rounded-xs font-semibold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-signal-strong"
                                                >
                                                    {t('profile.email.resend')}
                                                </Link>
                                            </p>
                                            {status ===
                                                'verification-link-sent' && (
                                                <p className="font-medium text-success-text">
                                                    {t('profile.email.sent')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="bio">
                                        {t('profile.fields.bio')}
                                    </Label>
                                    <Textarea
                                        id="bio"
                                        className="min-h-24"
                                        defaultValue={auth.user.bio || ''}
                                        name="bio"
                                        placeholder={t(
                                            'profile.fields.bio_placeholder',
                                        )}
                                    />
                                    <InputError message={errors.bio} />
                                </div>

                                <div className="flex items-center gap-4 border-t pt-5">
                                    <Button
                                        disabled={processing}
                                        data-test="update-profile-button"
                                    >
                                        {t('profile.save')}
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
                                            {t('profile.saved')}
                                        </p>
                                    </Transition>
                                </div>
                            </>
                        )}
                    </Form>
                </SectionPanel>

                <SectionPanel
                    title={t('profile.details.title')}
                    description={t('profile.details.desc')}
                >
                    <SectionRow
                        label={t('profile.details.vout_id.title')}
                        description={t('profile.details.vout_id.desc')}
                    >
                        <code className="block rounded-control border bg-surface-sunken px-3 py-1.5 font-mono text-xs break-all select-all sm:max-w-64">
                            {auth.user.vout_id}
                        </code>
                    </SectionRow>
                    <SectionRow
                        label={t('profile.details.google.title')}
                        description={t('profile.details.google.desc')}
                    >
                        {googleLinked ? (
                            <div className="flex items-center gap-3">
                                <Badge variant="success">
                                    {t('profile.details.google.connected')}
                                </Badge>
                                {auth.user.has_password && (
                                    <Button asChild variant="ghost" size="sm">
                                        <Link
                                            href="/settings/google"
                                            method="delete"
                                            as="button"
                                            type="button"
                                        >
                                            {t(
                                                'profile.details.google.disconnect',
                                            )}
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Badge variant="outline">
                                {t('profile.details.google.not_connected')}
                            </Badge>
                        )}
                    </SectionRow>
                </SectionPanel>
            </SettingsLayout>
        </AppLayout>
    );
}

/**
 * Foto de perfil: la actual (o las iniciales) y un botón para elegir otra,
 * con vista previa antes de guardar. El campo de archivo nativo queda oculto
 * (su texto sale en el idioma del navegador, no en el del portal) pero sigue
 * siendo el que recibe el foco y el que se envía con el formulario.
 */
function AvatarPicker({
    name,
    current,
    error,
}: {
    name: string;
    current: string | null;
    error?: string;
}) {
    const { t } = useTranslation();
    const getInitials = useInitials();
    const [preview, setPreview] = useState<{
        url: string;
        file: string;
    } | null>(null);

    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview.url);
            }
        };
    }, [preview]);

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setPreview(
            file ? { url: URL.createObjectURL(file), file: file.name } : null,
        );
    };

    return (
        <div className="grid gap-2">
            <span className="text-sm leading-none font-semibold">
                {t('profile.fields.avatar')}
            </span>
            <div className="flex items-center gap-4">
                <Avatar className="size-16 rounded-surface border border-border-strong">
                    <AvatarImage
                        src={preview?.url ?? current ?? undefined}
                        alt=""
                        className="object-cover"
                    />
                    <AvatarFallback className="rounded-surface bg-surface-sunken text-base font-bold text-foreground">
                        {getInitials(name)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1.5">
                    <input
                        id="avatar"
                        type="file"
                        name="avatar"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        className="peer sr-only"
                        onChange={onChange}
                        aria-describedby="avatar-hint"
                    />
                    <Label
                        htmlFor="avatar"
                        className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-key-light px-3 text-sm font-semibold shadow-[0_2px_0_0_var(--key-light-edge)] transition-[transform,box-shadow,background-color] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:bg-surface-hover active:translate-y-[2px] active:shadow-none"
                    >
                        <ImageUp className="size-4" aria-hidden />
                        {t('profile.fields.avatar_choose')}
                    </Label>
                    <p
                        id="avatar-hint"
                        className="truncate text-xs text-muted-foreground"
                    >
                        {preview?.file ?? t('profile.fields.avatar_hint')}
                    </p>
                    <InputError message={error} />
                </div>
            </div>
        </div>
    );
}
