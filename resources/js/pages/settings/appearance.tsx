import { Transition } from '@headlessui/react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Aperture, Paintbrush, Smile } from 'lucide-react';
import type { FormEventHandler } from 'react';

import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
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
        dark_mode: auth.user.settings?.dark_mode ?? true,
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
                <div className="space-y-8">
                    {/* Theme Preference */}
                    <div className="glass-card-light space-y-6 rounded-xl p-6 md:p-8">
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
                    <div className="glass-card-light space-y-6 rounded-xl p-6 md:p-8">
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

                            {/* Mascot Placeholder Box */}
                            {data.show_mascot && (
                                <div className="animate-in duration-500 ease-out fade-in slide-in-from-top-4">
                                    <div className="flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 md:h-48">
                                        <div className="space-y-2 text-center">
                                            <Smile className="mx-auto h-8 w-8 text-primary/40 animate-bounce" />
                                            <p className="text-sm font-medium text-primary/60">
                                                Mascot Preview Area
                                            </p>
                                        </div>
                                    </div>
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
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <CalibrationWizard
                                        saveUrl={activeGestureConfig ? `/gesture-configs/${activeGestureConfig.id}` : '/gesture-configs'}
                                        saveMethod={activeGestureConfig ? 'put' : 'post'}
                                        hasExistingProfile={!!activeGestureConfig}
                                        existingProfileName={activeGestureConfig?.profile_name}
                                        initialSensitivity={activeGestureConfig?.sensitivity ?? 5}
                                    />

                                    {/* Mapping editor: solo visible si ya existe un perfil activo */}
                                    {activeGestureConfig && (
                                        <GestureMappingEditor config={activeGestureConfig} />
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
