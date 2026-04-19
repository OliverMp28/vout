import { Head } from '@inertiajs/react';
import { ContinuePlayingCard } from '@/components/dashboard/continue-playing-card';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { EcosystemCard } from '@/components/dashboard/ecosystem-card';
import { LibraryCard } from '@/components/dashboard/library-card';
import type { DashboardLibrary } from '@/components/dashboard/library-card';
import { OnboardingHero } from '@/components/dashboard/onboarding-hero';
import { QuickStatsCard } from '@/components/dashboard/quick-stats-card';
import type { DashboardStats } from '@/components/dashboard/quick-stats-card';
import { RecommendationsStrip } from '@/components/dashboard/recommendations-strip';
import { useMascotContext } from '@/hooks/use-mascot-context';
import { useOnboardingGuide } from '@/hooks/use-onboarding-guide';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import type { BreadcrumbItem, Game } from '@/types';

type DashboardEcosystem = {
    voutId: string;
    isDeveloper: boolean;
    isAdmin: boolean;
    developerAppsCount: number | null;
};

type OnboardingStep = {
    key: 'explore' | 'gestures' | 'profile';
    done: boolean;
};

type OnboardingState = {
    show: boolean;
    steps: OnboardingStep[];
};

type RecommendationReason = {
    key: string;
    params: Record<string, string>;
};

type DashboardProps = {
    greeting: {
        name: string;
        hourOfDay: number;
    };
    continuePlaying: { data: Game } | null;
    stats: DashboardStats;
    library: DashboardLibrary;
    recommendations: { data: Game[] };
    recommendationReason: RecommendationReason | null;
    ecosystem: DashboardEcosystem;
    onboarding: OnboardingState;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
    },
];

/**
 * Sidecar sin render que sincroniza el estado de onboarding con el modo
 * `guide` de Vou (S8). Vive dentro del `AppLayout` del dashboard a
 * propósito: `useOnboardingGuide` depende de `useMascot()`, que sólo está
 * disponible debajo del `MascotProvider` (montado por `PortalLayout`). El
 * componente padre `Dashboard` está por encima del provider en el árbol,
 * así que no puede consumir el hook directamente.
 */
function OnboardingGuideSync({ onboarding }: { onboarding: OnboardingState }) {
    useOnboardingGuide(onboarding);
    return null;
}

export default function Dashboard({
    greeting,
    continuePlaying,
    stats,
    library,
    recommendations,
    recommendationReason,
    ecosystem,
    onboarding,
}: DashboardProps) {
    const { t } = useTranslation();

    const continueGame = continuePlaying?.data ?? null;
    const recommendedGames = recommendations.data;

    // ── Mensajes contextuales para Vou (S7) ────────────────────────────
    // Se evalúan en orden de prioridad cuando el usuario hace tap en la
    // mascota. El primero con `when: true` gana; si ninguno aplica, Vou
    // cae al saludo aleatorio estándar.
    const pendingOnboardingSteps = onboarding.show
        ? onboarding.steps.filter((s) => !s.done).length
        : 0;
    const hour = greeting.hourOfDay;

    useMascotContext([
        {
            id: 'dashboard.resume',
            priority: 30,
            auto: true,
            when: continueGame !== null,
            text: t('mascot.context.dashboard.resume', {
                game: continueGame?.name ?? '',
            }),
        },
        {
            id: 'dashboard.onboarding',
            priority: 20,
            auto: true,
            when: pendingOnboardingSteps > 0,
            text:
                pendingOnboardingSteps === 1
                    ? t('mascot.context.dashboard.onboarding_one')
                    : t('mascot.context.dashboard.onboarding', {
                          steps: pendingOnboardingSteps,
                      }),
        },
        {
            id: 'dashboard.greeting',
            priority: 10,
            when: true,
            text: t(
                hour < 6
                    ? 'mascot.context.dashboard.evening'
                    : hour < 12
                      ? 'mascot.context.dashboard.morning'
                      : hour < 20
                        ? 'mascot.context.dashboard.afternoon'
                        : 'mascot.context.dashboard.evening',
                { name: greeting.name },
            ),
        },
    ]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('dashboard.title')} />

            <OnboardingGuideSync onboarding={onboarding} />

            <div className="flex flex-col gap-8 p-6 md:p-8 lg:p-10">
                {onboarding.show && <OnboardingHero steps={onboarding.steps} />}

                <DashboardHeader
                    name={greeting.name}
                    hourOfDay={greeting.hourOfDay}
                />

                <div className="grid gap-6 md:grid-cols-[1fr_320px]">
                    <div className="flex flex-col gap-6">
                        <ContinuePlayingCard game={continueGame} />
                        <RecommendationsStrip
                            games={recommendedGames}
                            reason={recommendationReason}
                        />
                    </div>

                    <div className="flex flex-col gap-6">
                        <QuickStatsCard stats={stats} />
                        <LibraryCard library={library} />
                        <EcosystemCard
                            voutId={ecosystem.voutId}
                            isDeveloper={ecosystem.isDeveloper}
                            isAdmin={ecosystem.isAdmin}
                            developerAppsCount={ecosystem.developerAppsCount}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
