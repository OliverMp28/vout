import { Transition } from '@headlessui/react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';

import AppearanceTabs from '@/components/appearance-tabs';
import { CelebrateOnSuccess } from '@/components/mascot/celebrate-on-success';
import { VouPreview } from '@/components/mascot/vou-preview';
import { SectionPanel } from '@/components/section-panel';
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

                <SectionPanel
                    title={t('appearance.theme.title')}
                    description={t('appearance.theme.desc')}
                >
                    <AppearanceTabs />
                </SectionPanel>

                <SectionPanel
                    title={t('appearance.ecosystem.title')}
                    description={t('appearance.ecosystem.desc')}
                    aside={
                        <Transition
                            show={recentlySuccessful}
                            enter="transition-opacity ease-out"
                            enterFrom="opacity-0"
                            leave="transition-opacity ease-in"
                            leaveTo="opacity-0"
                        >
                            <p
                                role="status"
                                className="shrink-0 text-sm font-medium text-success-text"
                            >
                                {t('profile.saved')}
                            </p>
                        </Transition>
                    }
                >
                    <div className="grid gap-5">
                        <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <Label
                                    htmlFor="show_mascot"
                                    className="text-base font-bold"
                                >
                                    {t('appearance.mascot.title')}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    {t('appearance.mascot.desc')}
                                </p>
                            </div>
                            <Switch
                                id="show_mascot"
                                checked={data.show_mascot}
                                onCheckedChange={(checked) =>
                                    save('show_mascot', checked)
                                }
                            />
                        </div>

                        {data.show_mascot && <VouPreview />}
                    </div>
                </SectionPanel>

                <SectionPanel
                    headingId="facial-control-heading"
                    title={t('appearance.facial_control.title')}
                    description={t('appearance.facial_control.desc')}
                >
                    <div className="grid gap-4">
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
                                        className="flex items-start gap-3 rounded-control border p-3 transition-colors has-data-[state=checked]:border-signal-edge has-data-[state=checked]:bg-signal-soft"
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
                                                className="font-bold"
                                            >
                                                {t(
                                                    `appearance.facial_control.usage.${usage}.label`,
                                                )}
                                            </Label>
                                            <p
                                                id={`${id}-desc`}
                                                className="text-sm text-muted-foreground"
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
                            <div className="flex items-start gap-3 rounded-control border border-dashed border-border-strong p-3">
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
                                        className="font-bold"
                                    >
                                        {t(
                                            'appearance.facial_control.autostart.label',
                                        )}
                                    </Label>
                                    <p
                                        id="camera_autostart-desc"
                                        className="text-sm text-muted-foreground"
                                    >
                                        {t(
                                            'appearance.facial_control.autostart.desc',
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/*
                         * Aviso de procesamiento local: MediaPipe procesa los
                         * fotogramas en el navegador (en un Web Worker) y solo
                         * se guardan parámetros numéricos. La justificación
                         * legal completa está en la Política de Privacidad.
                         */}
                        {usesCamera && (
                            <div className="flex items-start gap-3 border-t pt-4 text-sm">
                                <ShieldCheck
                                    className="mt-0.5 size-5 shrink-0 text-success-text"
                                    aria-hidden="true"
                                />
                                <div className="space-y-1">
                                    <p className="font-bold">
                                        {t('appearance.camera_notice.title')}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {t('appearance.camera_notice.desc')}
                                    </p>
                                    <Link
                                        href={legalShow('privacidad').url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex rounded-xs font-semibold underline decoration-border-strong underline-offset-4 hover:decoration-signal-strong"
                                    >
                                        {t('appearance.camera_notice.link')}
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </SectionPanel>

                {/* Asistente y mapeo (con el control facial en uso) */}
                {usesCamera && (
                    <>
                        <div className="rounded-surface border bg-surface-1 p-5 shadow-surface md:p-6">
                            <CalibrationWizard
                                saveUrl={
                                    activeGestureConfig
                                        ? `/gesture-configs/${activeGestureConfig.id}`
                                        : '/gesture-configs'
                                }
                                saveMethod={
                                    activeGestureConfig ? 'put' : 'post'
                                }
                                hasExistingProfile={!!activeGestureConfig}
                                existingProfileName={
                                    activeGestureConfig?.profile_name
                                }
                                initialSensitivity={
                                    activeGestureConfig?.sensitivity ?? 5
                                }
                            />
                        </div>

                        {/* Editor del mapeo: solo con un perfil activo */}
                        {activeGestureConfig && (
                            <div className="rounded-surface border bg-surface-1 p-5 shadow-surface md:p-6">
                                <GestureMappingEditor
                                    config={activeGestureConfig}
                                />
                            </div>
                        )}
                    </>
                )}
            </SettingsLayout>
        </AppLayout>
    );
}
