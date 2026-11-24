import { Form } from '@inertiajs/react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AlertError from '@/components/alert-error';
import { SectionPanel } from '@/components/section-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { regenerateRecoveryCodes } from '@/routes/two-factor';

type Props = {
    recoveryCodesList: string[];
    fetchRecoveryCodes: () => Promise<void>;
    errors: string[];
};

export default function TwoFactorRecoveryCodes({
    recoveryCodesList,
    fetchRecoveryCodes,
    errors,
}: Props) {
    const { t } = useTranslation();
    const [codesAreVisible, setCodesAreVisible] = useState<boolean>(false);
    const codesSectionRef = useRef<HTMLDivElement | null>(null);
    const canRegenerateCodes = recoveryCodesList.length > 0 && codesAreVisible;

    const toggleCodesVisibility = useCallback(async () => {
        if (!codesAreVisible && !recoveryCodesList.length) {
            await fetchRecoveryCodes();
        }

        setCodesAreVisible(!codesAreVisible);

        if (!codesAreVisible) {
            setTimeout(() => {
                codesSectionRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                });
            });
        }
    }, [codesAreVisible, recoveryCodesList.length, fetchRecoveryCodes]);

    useEffect(() => {
        if (!recoveryCodesList.length) {
            fetchRecoveryCodes();
        }
    }, [recoveryCodesList.length, fetchRecoveryCodes]);

    const RecoveryCodeIconComponent = codesAreVisible ? EyeOff : Eye;

    return (
        <SectionPanel
            title={t('two_factor.codes.title')}
            description={t('two_factor.codes.desc')}
        >
            <div className="flex flex-col gap-3 select-none sm:flex-row sm:items-center sm:justify-between">
                <Button
                    variant="secondary"
                    onClick={toggleCodesVisibility}
                    className="w-fit"
                    aria-expanded={codesAreVisible}
                    aria-controls="recovery-codes-section"
                >
                    <RecoveryCodeIconComponent
                        className="size-4"
                        aria-hidden="true"
                    />
                    {codesAreVisible
                        ? t('two_factor.codes.hide')
                        : t('two_factor.codes.show')}
                </Button>

                {canRegenerateCodes && (
                    <Form
                        {...regenerateRecoveryCodes.form()}
                        options={{ preserveScroll: true }}
                        onSuccess={fetchRecoveryCodes}
                    >
                        {({ processing }) => (
                            <Button
                                variant="ghost"
                                type="submit"
                                disabled={processing}
                                aria-describedby="regenerate-warning"
                            >
                                <RefreshCw />
                                {t('two_factor.codes.regenerate')}
                            </Button>
                        )}
                    </Form>
                )}
            </div>
            <div
                id="recovery-codes-section"
                className={cn(
                    'relative overflow-hidden transition-opacity duration-200',
                    codesAreVisible ? 'h-auto opacity-100' : 'h-0 opacity-0',
                )}
                aria-hidden={!codesAreVisible}
            >
                <div className="mt-4 space-y-3">
                    {errors?.length ? (
                        <AlertError errors={errors} />
                    ) : (
                        <>
                            <div
                                ref={codesSectionRef}
                                className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-control border bg-surface-sunken p-4 font-mono text-sm"
                                role="list"
                                aria-label={t('two_factor.codes.list')}
                            >
                                {recoveryCodesList.length ? (
                                    recoveryCodesList.map((code, index) => (
                                        <div
                                            key={index}
                                            role="listitem"
                                            className="select-text"
                                        >
                                            {code}
                                        </div>
                                    ))
                                ) : (
                                    <div
                                        className="col-span-2 space-y-2"
                                        aria-label={t(
                                            'two_factor.codes.loading',
                                        )}
                                    >
                                        {Array.from(
                                            { length: 8 },
                                            (_, index) => (
                                                <Skeleton
                                                    key={index}
                                                    className="h-4"
                                                />
                                            ),
                                        )}
                                    </div>
                                )}
                            </div>

                            <p
                                id="regenerate-warning"
                                className="text-sm text-muted-foreground select-none"
                            >
                                {t('two_factor.codes.note')}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </SectionPanel>
    );
}
