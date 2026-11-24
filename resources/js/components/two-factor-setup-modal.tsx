import { Form } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Check, Copy, ScanLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTranslation } from '@/hooks/use-translation';
import { OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';
import { confirm } from '@/routes/two-factor';

function ScanIcon() {
    return (
        <div
            aria-hidden="true"
            className="mb-2 flex size-12 items-center justify-center rounded-control border border-border-strong bg-key-light shadow-[0_2px_0_0_var(--key-light-edge)]"
        >
            <ScanLine className="size-6 text-foreground" />
        </div>
    );
}

function TwoFactorSetupStep({
    qrCodeSvg,
    manualSetupKey,
    buttonText,
    onNextStep,
    errors,
}: {
    qrCodeSvg: string | null;
    manualSetupKey: string | null;
    buttonText: string;
    onNextStep: () => void;
    errors: string[];
}) {
    const { t } = useTranslation();
    const [copiedText, copy] = useClipboard();
    const copied = copiedText === manualSetupKey;
    const IconComponent = copied ? Check : Copy;

    return (
        <>
            {errors?.length ? (
                <AlertError errors={errors} />
            ) : (
                <>
                    <div className="mx-auto flex max-w-md overflow-hidden">
                        <div className="mx-auto aspect-square w-64 rounded-surface border bg-surface-sunken">
                            <div className="z-10 flex h-full w-full items-center justify-center p-5">
                                {qrCodeSvg ? (
                                    <div
                                        className="aspect-square w-full rounded-control bg-on-media p-2 [&_svg]:size-full"
                                        dangerouslySetInnerHTML={{
                                            __html: qrCodeSvg,
                                        }}
                                    />
                                ) : (
                                    <Spinner />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full space-x-5">
                        <Button className="w-full" onClick={onNextStep}>
                            {buttonText}
                        </Button>
                    </div>

                    <div className="relative flex w-full items-center justify-center">
                        <div className="absolute inset-0 top-1/2 h-px w-full bg-border" />
                        <span className="relative bg-surface-2 px-2 py-1 text-sm text-muted-foreground">
                            {t('two_factor.setup.manual')}
                        </span>
                    </div>

                    <div className="flex w-full space-x-2">
                        <div className="flex w-full items-stretch overflow-hidden rounded-control border border-border-strong">
                            {!manualSetupKey ? (
                                <div className="flex h-full w-full items-center justify-center bg-surface-sunken p-3">
                                    <Spinner />
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        readOnly
                                        value={manualSetupKey}
                                        aria-label={t(
                                            'two_factor.setup.key_label',
                                        )}
                                        className="h-full w-full bg-surface-1 p-3 font-mono text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copy(manualSetupKey)}
                                        aria-label={
                                            copied
                                                ? t('two_factor.setup.copied')
                                                : t('two_factor.setup.copy')
                                        }
                                        className="border-l border-border-strong bg-key-light px-3 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                    >
                                        <IconComponent
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

function TwoFactorVerificationStep({
    onClose,
    onBack,
}: {
    onClose: () => void;
    onBack: () => void;
}) {
    const { t } = useTranslation();
    const [code, setCode] = useState<string>('');
    const pinInputContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setTimeout(() => {
            pinInputContainerRef.current?.querySelector('input')?.focus();
        }, 0);
    }, []);

    return (
        <Form
            {...confirm.form()}
            onSuccess={() => onClose()}
            resetOnError
            resetOnSuccess
        >
            {({
                processing,
                errors,
            }: {
                processing: boolean;
                errors?: { confirmTwoFactorAuthentication?: { code?: string } };
            }) => (
                <>
                    <div
                        ref={pinInputContainerRef}
                        className="relative w-full space-y-3"
                    >
                        <div className="flex w-full flex-col items-center space-y-3 py-2">
                            <InputOTP
                                id="otp"
                                name="code"
                                maxLength={OTP_MAX_LENGTH}
                                onChange={setCode}
                                disabled={processing}
                                pattern={REGEXP_ONLY_DIGITS}
                            >
                                <InputOTPGroup>
                                    {Array.from(
                                        { length: OTP_MAX_LENGTH },
                                        (_, index) => (
                                            <InputOTPSlot
                                                key={index}
                                                index={index}
                                            />
                                        ),
                                    )}
                                </InputOTPGroup>
                            </InputOTP>
                            <InputError
                                message={
                                    errors?.confirmTwoFactorAuthentication?.code
                                }
                            />
                        </div>

                        <div className="flex w-full space-x-5">
                            <Button
                                type="button"
                                variant="secondary"
                                className="flex-1"
                                onClick={onBack}
                                disabled={processing}
                            >
                                {t('two_factor.setup.back')}
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={
                                    processing || code.length < OTP_MAX_LENGTH
                                }
                            >
                                {t('two_factor.setup.confirm')}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </Form>
    );
}

type Props = {
    isOpen: boolean;
    onClose: () => void;
    requiresConfirmation: boolean;
    twoFactorEnabled: boolean;
    qrCodeSvg: string | null;
    manualSetupKey: string | null;
    clearSetupData: () => void;
    fetchSetupData: () => Promise<void>;
    errors: string[];
};

export default function TwoFactorSetupModal({
    isOpen,
    onClose,
    requiresConfirmation,
    twoFactorEnabled,
    qrCodeSvg,
    manualSetupKey,
    clearSetupData,
    fetchSetupData,
    errors,
}: Props) {
    const { t } = useTranslation();
    const [showVerificationStep, setShowVerificationStep] =
        useState<boolean>(false);

    const modalConfig = useMemo<{
        title: string;
        description: string;
        buttonText: string;
    }>(() => {
        if (twoFactorEnabled) {
            return {
                title: t('two_factor.setup.done_title'),
                description: t('two_factor.setup.done_desc'),
                buttonText: t('two_factor.setup.close'),
            };
        }

        if (showVerificationStep) {
            return {
                title: t('two_factor.setup.verify_title'),
                description: t('two_factor.setup.verify_desc'),
                buttonText: t('two_factor.setup.continue'),
            };
        }

        return {
            title: t('two_factor.setup.title'),
            description: t('two_factor.setup.desc'),
            buttonText: t('two_factor.setup.continue'),
        };
    }, [twoFactorEnabled, showVerificationStep, t]);

    const handleModalNextStep = useCallback(() => {
        if (requiresConfirmation) {
            setShowVerificationStep(true);
            return;
        }

        clearSetupData();
        onClose();
    }, [requiresConfirmation, clearSetupData, onClose]);

    const resetModalState = useCallback(() => {
        setShowVerificationStep(false);

        if (twoFactorEnabled) {
            clearSetupData();
        }
    }, [twoFactorEnabled, clearSetupData]);

    useEffect(() => {
        if (isOpen && !qrCodeSvg) {
            fetchSetupData();
        }
    }, [isOpen, qrCodeSvg, fetchSetupData]);

    const handleClose = useCallback(() => {
        resetModalState();
        onClose();
    }, [onClose, resetModalState]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="flex items-center justify-center">
                    <ScanIcon />
                    <DialogTitle>{modalConfig.title}</DialogTitle>
                    <DialogDescription className="text-center">
                        {modalConfig.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center space-y-5">
                    {showVerificationStep ? (
                        <TwoFactorVerificationStep
                            onClose={onClose}
                            onBack={() => setShowVerificationStep(false)}
                        />
                    ) : (
                        <TwoFactorSetupStep
                            qrCodeSvg={qrCodeSvg}
                            manualSetupKey={manualSetupKey}
                            buttonText={modalConfig.buttonText}
                            onNextStep={handleModalNextStep}
                            errors={errors}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
