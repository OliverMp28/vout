import { Link } from '@inertiajs/react';
import { VouSvg } from '@/components/mascot/vou-svg';
import { Kbd } from '@/components/ui/kbd';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { show as legalShow } from '@/routes/legal';

/** Gestos reales de los controles de plataformas (action-presets.ts). */
const GESTURES = [
    { gesture: 'brows', keys: ['Espacio'], action: 'jump' },
    { gesture: 'mouth', keys: ['↓'], action: 'duck' },
    { gesture: 'head', keys: ['←', '→'], action: 'move' },
] as const;

/**
 * Cómo funcionan los gestos, en tres pasos y con Vou. Explica sin pedir la
 * cámara: en la portada nunca se enciende.
 */
export function GesturesHowto() {
    const { t } = useTranslation();

    return (
        <section aria-labelledby="welcome-howto-title">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2
                    id="welcome-howto-title"
                    className="text-xl font-bold tracking-tight"
                >
                    {t('welcome.howto.title')}
                </h2>
                <Link
                    href={legalShow('privacidad').url}
                    className="text-sm font-semibold underline decoration-border-strong underline-offset-4 hover:decoration-signal-strong"
                >
                    {t('welcome.howto.privacy')}
                </Link>
            </div>

            <ol className="grid overflow-hidden rounded-surface border bg-surface-1 shadow-surface md:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
                <li
                    aria-hidden="true"
                    className="hidden place-items-center border-r bg-surface-sunken p-4 md:grid"
                >
                    <div className="size-20">
                        <VouSvg />
                    </div>
                </li>
                {(['choose', 'camera', 'gesture'] as const).map(
                    (step, index) => (
                        <li
                            key={step}
                            className={cn(
                                'grid content-start gap-1.5 p-4',
                                index > 0 &&
                                    'border-t md:border-t-0 md:border-l',
                            )}
                        >
                            <span className="font-pixel-label text-base leading-none text-muted-foreground">
                                {t('welcome.howto.step', {
                                    number: String(index + 1),
                                })}
                            </span>
                            <h3 className="text-base font-bold">
                                {t(`welcome.howto.${step}.title`)}
                            </h3>
                            {step === 'gesture' ? (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        {t('welcome.howto.gesture.example')}
                                    </p>
                                    <ul className="grid gap-1.5 pt-0.5 text-sm">
                                        {GESTURES.map((item) => (
                                            <li
                                                key={item.gesture}
                                                className="flex flex-wrap items-center gap-1.5"
                                            >
                                                <span>
                                                    {t(
                                                        `welcome.howto.gesture.${item.gesture}`,
                                                    )}
                                                </span>
                                                <span aria-hidden="true">
                                                    →
                                                </span>
                                                {item.keys.map((key) => (
                                                    <Kbd key={key}>
                                                        {key === 'Espacio'
                                                            ? t(
                                                                  'welcome.howto.space',
                                                              )
                                                            : key}
                                                    </Kbd>
                                                ))}
                                                <span className="text-muted-foreground">
                                                    {t(
                                                        `welcome.howto.action.${item.action}`,
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t(`welcome.howto.${step}.desc`)}
                                </p>
                            )}
                        </li>
                    ),
                )}
            </ol>
        </section>
    );
}
