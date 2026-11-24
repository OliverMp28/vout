import { Form, Head } from '@inertiajs/react';
import { ShieldBan, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { SectionPanel } from '@/components/section-panel';
import TwoFactorRecoveryCodes from '@/components/two-factor-recovery-codes';
import TwoFactorSetupModal from '@/components/two-factor-setup-modal';
import { Button } from '@/components/ui/button';
import { StatusLight } from '@/components/ui/status-light';
import { useMascotContext } from '@/hooks/use-mascot-context';
import { useTranslation } from '@/hooks/use-translation';
import { useTwoFactorAuth } from '@/hooks/use-two-factor-auth';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { disable, enable, show } from '@/routes/two-factor';
import type { BreadcrumbItem } from '@/types';

type Props = {
    requiresConfirmation?: boolean;
    twoFactorEnabled?: boolean;
};

export default function TwoFactor({
    requiresConfirmation = false,
    twoFactorEnabled = false,
}: Props) {
    const { t } = useTranslation();
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('two_factor.title'),
            href: show(),
        },
    ];
    const {
        qrCodeSvg,
        hasSetupData,
        manualSetupKey,
        clearSetupData,
        fetchSetupData,
        recoveryCodesList,
        fetchRecoveryCodes,
        errors,
    } = useTwoFactorAuth();
    const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

    // Si 2FA está desactivado, Vou lo recomienda proactivamente; si está
    // activo, recuerda guardar los códigos de recuperación (tap-only).
    useMascotContext([
        {
            id: 'settings.twofactor.enable',
            priority: 20,
            auto: true,
            when: !twoFactorEnabled,
            text: t('mascot.context.settings.twofactor.enable'),
        },
        {
            id: 'settings.twofactor.recovery',
            priority: 10,
            when: twoFactorEnabled,
            text: t('mascot.context.settings.twofactor.recovery'),
        },
    ]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('two_factor.title')} />

            <h1 className="sr-only">{t('two_factor.title')}</h1>

            <SettingsLayout>
                <SectionPanel
                    title={t('two_factor.title')}
                    description={t('two_factor.desc')}
                    aside={
                        <span className="inline-flex items-center gap-2 rounded-control border bg-surface-sunken px-2.5 py-1 text-sm font-semibold">
                            <StatusLight
                                state={twoFactorEnabled ? 'on' : 'off'}
                            />
                            {twoFactorEnabled
                                ? t('two_factor.status.on')
                                : t('two_factor.status.off')}
                        </span>
                    }
                >
                    {twoFactorEnabled ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {t('two_factor.on_body')}
                            </p>
                            <Form {...disable.form()}>
                                {({ processing }) => (
                                    <Button
                                        variant="secondary"
                                        type="submit"
                                        disabled={processing}
                                    >
                                        <ShieldBan />
                                        {t('two_factor.disable')}
                                    </Button>
                                )}
                            </Form>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {t('two_factor.off_body')}
                            </p>
                            {hasSetupData ? (
                                <Button onClick={() => setShowSetupModal(true)}>
                                    <ShieldCheck />
                                    {t('two_factor.continue_setup')}
                                </Button>
                            ) : (
                                <Form
                                    {...enable.form()}
                                    onSuccess={() => setShowSetupModal(true)}
                                >
                                    {({ processing }) => (
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            <ShieldCheck />
                                            {t('two_factor.enable')}
                                        </Button>
                                    )}
                                </Form>
                            )}
                        </div>
                    )}
                </SectionPanel>

                {twoFactorEnabled && (
                    <TwoFactorRecoveryCodes
                        recoveryCodesList={recoveryCodesList}
                        fetchRecoveryCodes={fetchRecoveryCodes}
                        errors={errors}
                    />
                )}

                <TwoFactorSetupModal
                    isOpen={showSetupModal}
                    onClose={() => setShowSetupModal(false)}
                    requiresConfirmation={requiresConfirmation}
                    twoFactorEnabled={twoFactorEnabled}
                    qrCodeSvg={qrCodeSvg}
                    manualSetupKey={manualSetupKey}
                    clearSetupData={clearSetupData}
                    fetchSetupData={fetchSetupData}
                    errors={errors}
                />
            </SettingsLayout>
        </AppLayout>
    );
}
