import { Transition } from '@headlessui/react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Aperture, Paintbrush, ShieldCheck, Smile } from 'lucide-react';
import type { FormEventHandler } from 'react';

import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { CelebrateOnSuccess } from '@/components/mascot/celebrate-on-success';
import { VouPreview } from '@/components/mascot/vou-preview';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CalibrationWizard } from '@/components/vision/calibration-wizard';
import { GestureMappingEditor } from '@/components/vision/gesture-mapping-editor';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import type { GestureConfigData } from '@/lib/mediapipe/types';
import { edit as editAppearance } from '@/routes/appearance';
import { show as legalShow } from '@/routes/legal';
import type { Auth, BreadcrumbItem } from '@/types';

type AppearanceProps = {
    activeGestureConfig: GestureConfigData | null;
};

export default function Appearance({ activeGestureConfig }: AppearanceProps) {
    const auth = usePage().props.auth as Auth;
    const { t } = useTranslation();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('profile.settings.appearance'),
            href: editAppearance(),
        },
    ];

    const { data, setData, patch, processing, recentlySuccessful } = useForm({
        show_mascot: auth.user.settings?.show_mascot ?? true,
        gestures_enabled: auth.user.settings?.gestures_enabled ?? false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch('/settings/appearance', {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('profile.settings.appearance')} />

            <h1 className="sr-only">{t('profile.settings.appearance')}</h1>

            <SettingsLayout>
                <CelebrateOnSuccess recentlySuccessful={recentlySuccessful} />
                <div className="space-y-8">
                    {/* Theme Preference */}
                    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 rounded-lg bg-primary/10 p-3">
                                <Paintbrush className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <Heading
                                    variant="small"
                                    title={t('appearance.theme.title')}
                                    description={t('appearance.theme.desc')}
                                />
                                <div className="mt-4">
                                    <AppearanceTabs />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vout Ecosystem Preferences */}
                    <div className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
                        <Heading
                            variant="small"
                            title={t('appearance.ecosystem.title')}
                            description={t('appearance.ecosystem.desc')}
                        />

                        <form onSubmit={submit} className="mt-6 space-y-8">
                            {/* Mascot Toggle */}
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-background/50 p-4">
                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 rounded-md bg-pink-500/10 p-2">
                                        <Smile className="h-5 w-5 text-pink-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label
                                            htmlFor="show_mascot"
                                            className="text-base font-medium"
                                        >
                                            {t('appearance.mascot.title')}
                                        </Label>
                                        <p className="w-full text-sm text-muted-foreground md:w-3/4">
                                            {t('appearance.mascot.desc')}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    id="show_mascot"
                                    checked={data.show_mascot}
                                    onCheckedChange={(checked) =>
                                        setData('show_mascot', checked)
                                    }
                                />
                            </div>

                            {/* Mascot Preview */}
                            {data.show_mascot && (
                                <div className="animate-in duration-500 ease-out fade-in slide-in-from-top-4">
                                    <VouPreview />
                                </div>
                            )}

                            {/* Gestures Toggle */}
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-background/50 p-4">
                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 rounded-md bg-blue-500/10 p-2">
                                        <Aperture className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label
                                            htmlFor="gestures_enabled"
                                            className="text-base font-medium"
                                        >
                                            {t('appearance.gestures.title')}
                                        </Label>
                                        <p className="w-full text-sm text-muted-foreground md:w-3/4">
                                            {t('appearance.gestures.desc')}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    id="gestures_enabled"
                                    checked={data.gestures_enabled}
                                    onCheckedChange={(checked) =>
                                        setData('gestures_enabled', checked)
                                    }
                                />
                            </div>

                            {/* Calibration Wizard (shown when gestures enabled) */}
                            {data.gestures_enabled && (
                                <div className="animate-in space-y-6 duration-500 fade-in slide-in-from-top-4">
                                    {/*
                                     * Aviso de procesamiento local exigido por el plan de Fase 5.
                                     * MediaPipe procesa los frames en el propio navegador mediante
                                     * un Web Worker (ver app/Http/Controllers/... — la justificación
                                     * legal completa vive en la Política de Privacidad). Este bloque
                                     * recuerda al usuario que su vídeo no sale nunca del dispositivo
                                     * y sólo se guardan parámetros numéricos de configuración.
                                     */}
                                    <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                                        <ShieldCheck
                                            className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                                            aria-hidden="true"
                                        />
                                        <div className="space-y-1.5 text-sm">
                                            <p className="font-medium text-emerald-900 dark:text-emerald-100">
                                                {t(
                                                    'appearance.camera_notice.title',
                                                )}
                                            </p>
                                            <p className="text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-200/80">
                                                {t(
                                                    'appearance.camera_notice.desc',
                                                )}
                                            </p>
                                            <Link
                                                href={
                                                    legalShow('privacidad').url
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                                            >
                                                {t(
                                                    'appearance.camera_notice.link',
                                                )}
                                            </Link>
                                        </div>
                                    </div>

                                    <CalibrationWizard
                                        saveUrl={
                                            activeGestureConfig
                                                ? `/gesture-configs/${activeGestureConfig.id}`
                                                : '/gesture-configs'
                                        }
                                        saveMethod={
                                            activeGestureConfig ? 'put' : 'post'
                                        }
                                        hasExistingProfile={
                                            !!activeGestureConfig
                                        }
                                        existingProfileName={
                                            activeGestureConfig?.profile_name
                                        }
                                        initialSensitivity={
                                            activeGestureConfig?.sensitivity ??
                                            5
                                        }
                                    />

                                    {/* Mapping editor: solo visible si ya existe un perfil activo */}
                                    {activeGestureConfig && (
                                        <GestureMappingEditor
                                            config={activeGestureConfig}
                                        />
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-4 border-t border-border/40 pt-4">
                                <Button disabled={processing} type="submit">
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

                                <p className="ml-auto text-xs text-muted-foreground">
                                    {t('appearance.save_hint')}
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
