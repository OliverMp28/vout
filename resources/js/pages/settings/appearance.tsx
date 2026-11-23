import { Transition } from '@headlessui/react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Aperture, Paintbrush, ShieldCheck, Smile } from 'lucide-react';

import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { CelebrateOnSuccess } from '@/components/mascot/celebrate-on-success';
import { VouPreview } from '@/components/mascot/vou-preview';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { CalibrationWizard } from '@/components/vision/calibration-wizard';
import { GestureMappingEditor } from '@/components/vision/gesture-mapping-editor';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { sharedRuntimeHost } from '@/lib/mediapipe/shared-runtime';
import type { GestureConfigData } from '@/lib/mediapipe/types';
import { edit as editAppearance } from '@/routes/appearance';
import { show as legalShow } from '@/routes/legal';
import { update as updateUserSettings } from '@/routes/user-settings';
import type { Auth, BreadcrumbItem, FacialControlUsage } from '@/types';

type AppearanceProps = {
    activeGestureConfig: GestureConfigData | null;
};

type EcosystemSettings = {
    show_mascot: boolean;
    facial_control_usage: FacialControlUsage;
    camera_autostart: boolean;
};

const USAGE_OPTIONS: readonly FacialControlUsage[] = [
    'off',
    'occasional',
    'primary',
];

/**
 * Ajustes → Apariencia: tema, mascota y cómo se usa el control facial.
 *
 * Cada control se guarda al cambiarlo (como el tema), sin botón Guardar.
 * El asistente y el editor de mapeo guardan por su cuenta: no van dentro de
 * ningún formulario, así que sus botones no envían nada más.
 */
export default function Appearance({ activeGestureConfig }: AppearanceProps) {
    const auth = usePage().props.auth as Auth;
    const settings = auth.user.settings;
    const { t } = useTranslation();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('profile.settings.appearance'),
            href: editAppearance(),
        },
    ];

    const { data, setData, transform, patch, recentlySuccessful } =
        useForm<EcosystemSettings>({
            show_mascot: settings?.show_mascot ?? true,
            facial_control_usage: settings?.facial_control_usage ?? 'off',
            camera_autostart: settings?.camera_autostart ?? false,
        });

    /** Guarda un ajuste en cuanto cambia (solo ese campo). */
    const save = <K extends keyof EcosystemSettings>(
        key: K,
        value: EcosystemSettings[K],
    ): void => {
        setData((current) => ({ ...current, [key]: value }));
        transform(() => ({ [key]: value }));
        patch(updateUserSettings().url, {
            preserveScroll: true,
            // Guardar no debe reiniciar el asistente si está a medias.
            preserveState: true,
            onSuccess: () => {
                // Sin control facial, el motor que quedara cargado (de una
                // partida reciente) se libera ya, sin esperar.
                if (key === 'facial_control_usage' && value === 'off') {
                    sharedRuntimeHost.disposeIdle();
                }
            },
        });
    };

    const changeUsage = (usage: FacialControlUsage): void => {
        // El encendido automático es solo de "juego con la cámara": el
        // servidor lo apaga al cambiar de perfil, y aquí también.
        if (usage !== 'primary') {
            setData('camera_autostart', false);
        }
        save('facial_control_usage', usage);
    };

    const usesCamera = data.facial_control_usage !== 'off';

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
                        <div className="flex items-start justify-between gap-4">
                            <Heading
                                variant="small"
                                title={t('appearance.ecosystem.title')}
                                description={t('appearance.ecosystem.desc')}
                            />
                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p
                                    role="status"
                                    className="shrink-0 text-sm font-medium text-green-600 dark:text-green-400"
                                >
                                    {t('profile.saved')}
                                </p>
                            </Transition>
                        </div>

                        <div className="mt-6 space-y-8">
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
                                        save('show_mascot', checked)
                                    }
                                />
                            </div>

                            {/* Mascot Preview */}
                            {data.show_mascot && (
                                <div className="animate-in duration-500 ease-out fade-in slide-in-from-top-4">
                                    <VouPreview />
                                </div>
                            )}

                            {/* Perfil de uso del control facial */}
                            <section
                                aria-labelledby="facial-control-heading"
                                className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 rounded-md bg-blue-500/10 p-2">
                                        <Aperture className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h2
                                            id="facial-control-heading"
                                            className="text-base font-medium"
                                        >
                                            {t(
                                                'appearance.facial_control.title',
                                            )}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {t(
                                                'appearance.facial_control.desc',
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <RadioGroup
                                    id="facial_control_usage"
                                    value={data.facial_control_usage}
                                    onValueChange={(value) =>
                                        changeUsage(value as FacialControlUsage)
                                    }
                                    aria-labelledby="facial-control-heading"
                                >
                                    {USAGE_OPTIONS.map((usage) => {
                                        const id = `facial-control-usage-${usage}`;

                                        return (
                                            <div
                                                key={usage}
                                                className="flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors duration-200 has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5"
                                            >
                                                <RadioGroupItem
                                                    id={id}
                                                    value={usage}
                                                    aria-describedby={`${id}-desc`}
                                                    className="mt-0.5"
                                                />
                                                <div className="grid gap-1">
                                                    <Label
                                                        htmlFor={id}
                                                        className="font-medium"
                                                    >
                                                        {t(
                                                            `appearance.facial_control.usage.${usage}.label`,
                                                        )}
                                                    </Label>
                                                    <p
                                                        id={`${id}-desc`}
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        {t(
                                                            `appearance.facial_control.usage.${usage}.desc`,
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </RadioGroup>

                                {/* Encendido automático: aparte y solo para quien juega con la cámara */}
                                {data.facial_control_usage === 'primary' && (
                                    <div className="flex animate-in items-start gap-3 rounded-lg border border-dashed border-border/70 p-3 duration-300 fade-in">
                                        <Checkbox
                                            id="camera_autostart"
                                            checked={data.camera_autostart}
                                            onCheckedChange={(checked) =>
                                                save(
                                                    'camera_autostart',
                                                    checked === true,
                                                )
                                            }
                                            aria-describedby="camera_autostart-desc"
                                            className="mt-0.5"
                                        />
                                        <div className="grid gap-1">
                                            <Label
                                                htmlFor="camera_autostart"
                                                className="font-medium"
                                            >
                                                {t(
                                                    'appearance.facial_control.autostart.label',
                                                )}
                                            </Label>
                                            <p
                                                id="camera_autostart-desc"
                                                className="text-xs text-muted-foreground"
                                            >
                                                {t(
                                                    'appearance.facial_control.autostart.desc',
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* Asistente y mapeo (con el control facial en uso) */}
                            {usesCamera && (
                                <div className="animate-in space-y-6 duration-500 fade-in slide-in-from-top-4">
                                    {/*
                                     * Aviso de procesamiento local exigido por el plan de Fase 5.
                                     * MediaPipe procesa los frames en el propio navegador mediante
                                     * un Web Worker (la justificación legal completa vive en la
                                     * Política de Privacidad). Este bloque recuerda al usuario que
                                     * su vídeo no sale nunca del dispositivo y sólo se guardan
                                     * parámetros numéricos de configuración.
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
                        </div>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
