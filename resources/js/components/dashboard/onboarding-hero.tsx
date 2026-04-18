import { Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    Circle,
    Compass,
    Hand,
    Sparkles,
    User,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { edit as appearanceEdit } from '@/routes/appearance';
import { index as catalogIndex } from '@/routes/catalog';
import { dismiss as dismissWelcome } from '@/routes/dashboard/welcome';
import { edit as profileEdit } from '@/routes/profile';

export type OnboardingStepKey = 'explore' | 'gestures' | 'profile';

type OnboardingStep = {
    key: OnboardingStepKey;
    done: boolean;
};

type Props = {
    steps: OnboardingStep[];
};

type StepMeta = {
    icon: LucideIcon;
    href: string;
};

const STEP_META: Record<OnboardingStepKey, StepMeta> = {
    explore: { icon: Compass, href: catalogIndex.url() },
    gestures: { icon: Hand, href: appearanceEdit.url() },
    profile: { icon: User, href: profileEdit.url() },
};

export function OnboardingHero({ steps }: Props) {
    const { t } = useTranslation();

    const handleDismiss = () => {
        router.post(
            dismissWelcome.url(),
            {},
            {
                preserveScroll: true,
                only: ['onboarding'],
            },
        );
    };

    return (
        <section
            id="dashboard-onboarding"
            role="region"
            aria-labelledby="dashboard-onboarding-title"
            className={cn(
                'glass-card relative overflow-hidden p-6 md:p-8',
                'bg-linear-to-br from-primary/10 via-card to-accent/10',
            )}
        >
            <div
                className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/20 blur-3xl"
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute -bottom-12 -left-6 size-32 rounded-full bg-accent/20 blur-3xl"
                aria-hidden="true"
            />

            <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="absolute top-3 right-3 size-8 text-muted-foreground hover:text-foreground"
                aria-label={t('dashboard.onboarding.dismiss')}
            >
                <X className="size-4" aria-hidden="true" />
            </Button>

            <div className="relative space-y-1 pr-10">
                <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-primary uppercase">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    {t('dashboard.onboarding.eyebrow')}
                </div>
                <h2
                    id="dashboard-onboarding-title"
                    className="text-xl font-semibold md:text-2xl"
                >
                    {t('dashboard.onboarding.title')}
                </h2>
                <p className="max-w-xl text-sm text-muted-foreground">
                    {t('dashboard.onboarding.subtitle')}
                </p>
            </div>

            <ol className="relative mt-6 grid gap-3 md:grid-cols-3">
                {steps.map((step, index) => (
                    <OnboardingStepCard
                        key={step.key}
                        step={step}
                        index={index + 1}
                    />
                ))}
            </ol>
        </section>
    );
}

type OnboardingStepCardProps = {
    step: OnboardingStep;
    index: number;
};

function OnboardingStepCard({ step, index }: OnboardingStepCardProps) {
    const { t } = useTranslation();
    const { icon: Icon, href } = STEP_META[step.key];

    const label = t(`dashboard.onboarding.step.${step.key}.label`);
    const description = t(`dashboard.onboarding.step.${step.key}.description`);
    const cta = t(`dashboard.onboarding.step.${step.key}.cta`);
    const statusLabel = step.done
        ? t('dashboard.onboarding.step_done')
        : t('dashboard.onboarding.step_pending');

    return (
        <li
            className={cn(
                'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-all duration-200',
                step.done
                    ? 'border-primary/30'
                    : 'hover:border-primary/40 hover:shadow-md',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div
                    className={cn(
                        'flex size-10 items-center justify-center rounded-lg',
                        step.done
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground',
                    )}
                    aria-hidden="true"
                >
                    <Icon className="size-5" />
                </div>
                <span className="flex items-center gap-1 text-xs">
                    {step.done ? (
                        <CheckCircle2
                            className="size-4 text-primary"
                            aria-hidden="true"
                        />
                    ) : (
                        <Circle
                            className="size-4 text-muted-foreground/50"
                            aria-hidden="true"
                        />
                    )}
                    <span className="sr-only">{statusLabel}</span>
                    <span
                        className="text-muted-foreground"
                        aria-hidden="true"
                    >{`0${index}`}</span>
                </span>
            </div>
            <div className="space-y-1">
                <h3 className="text-sm font-semibold">{label}</h3>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Link
                href={href}
                className={cn(
                    'mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary',
                    'transition-colors hover:text-primary/80',
                    'focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                )}
            >
                {cta}
                <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
        </li>
    );
}
