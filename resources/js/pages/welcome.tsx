import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Fingerprint,
    Gamepad2,
    Hand,
    Sparkles,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeaturedCarousel } from '@/components/catalog/featured-carousel';
import { GameCard } from '@/components/catalog/game-card';
import { Button } from '@/components/ui/button';

import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { index as catalogIndex } from '@/routes/catalog';
import type { WelcomeProps } from '@/types';

export default function Welcome({ featured, popular, canRegister }: WelcomeProps) {
    const { auth } = usePage().props;
    const { t } = useTranslation();
    const isGuest = !auth?.user;

    const hasFeatured = featured.data.length > 0;
    const hasPopular = popular.data.length > 0;

    return (
        <PortalLayout>
            <Head title={t('portal.title')} />

            <div className="space-y-10">
                {/* Netflix-style carousel — primary hero */}
                {hasFeatured && (
                    <FeaturedCarousel games={featured.data} />
                )}

                {/* Fallback hero when no featured games */}
                {!hasFeatured && (
                    <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--vout-gradient-start) to-(--vout-gradient-end) px-6 py-16 text-center text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] md:py-20">
                        <div className="animate-float-slow absolute top-8 left-12 opacity-20">
                            <Gamepad2 className="size-16" />
                        </div>
                        <div
                            className="animate-float absolute right-16 bottom-10 opacity-20"
                            style={{ animationDelay: '2s' }}
                        >
                            <Zap className="size-12" />
                        </div>
                        <div
                            className="animate-float absolute top-16 right-1/4 opacity-15"
                            style={{ animationDelay: '1s' }}
                        >
                            <Sparkles className="size-10" />
                        </div>
                        <div className="relative z-10 mx-auto max-w-2xl space-y-6">
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                                {t('welcome.hero.title')}
                            </h1>
                            <p className="mx-auto max-w-lg text-base text-white/80 md:text-lg">
                                {t('welcome.hero.subtitle')}
                            </p>
                            <Button
                                asChild
                                id="btn-welcome-explore"
                                size="lg"
                                className="bg-white font-semibold text-primary hover:bg-white/90"
                            >
                                <Link href={catalogIndex.url()}>
                                    {t('welcome.hero.cta')}
                                    <ArrowRight className="ml-2 size-4" />
                                </Link>
                            </Button>
                        </div>
                    </section>
                )}

                {/* Value pillars strip — guests only, communicates Vout's identity in one glance */}
                {isGuest && <PillarsStrip />}

                {/* Register CTA strip — only for guests */}
                {canRegister && isGuest && (
                    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card/70 px-6 py-5 shadow-sm backdrop-blur-sm">
                        {/* Subtle brand glow on the right edge */}
                        <div
                            className="pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-60"
                            style={{
                                background:
                                    'radial-gradient(ellipse 60% 140% at 100% 50%, oklch(0.55 0.22 285 / 0.18) 0%, transparent 70%)',
                            }}
                            aria-hidden="true"
                        />
                        <div className="relative flex flex-col items-center justify-between gap-4 sm:flex-row">
                            <div className="flex items-center gap-3 text-center sm:text-left">
                                <div
                                    className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:flex"
                                    aria-hidden="true"
                                >
                                    <Sparkles className="size-5" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-sm font-semibold text-foreground">
                                        {t('welcome.register_cta.title')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('welcome.register_cta.subtitle')}
                                    </p>
                                </div>
                            </div>
                            <Button
                                asChild
                                id="btn-welcome-register"
                                size="sm"
                                className="shrink-0"
                            >
                                <Link href="/register">
                                    {t('welcome.register_cta.action')}
                                    <ArrowRight className="ml-1.5 size-3.5" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}


                {/* Popular Games */}
                {hasPopular && (
                    <section className="space-y-4" aria-labelledby="section-popular">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="inline-block h-6 w-1 rounded-full bg-linear-to-b from-primary to-primary/40"
                                    aria-hidden="true"
                                />
                                <h2
                                    id="section-popular"
                                    className="text-lg font-semibold tracking-tight"
                                >
                                    {t('welcome.popular.title')}
                                </h2>
                            </div>
                            <Link
                                href={catalogIndex.url()}
                                className="group/link inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
                            >
                                {t('welcome.view_all')}
                                <ArrowRight className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5" />
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                            {popular.data.slice(0, 8).map((game) => (
                                <GameCard key={game.id} game={game} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </PortalLayout>
    );
}

type Pillar = {
    key: 'identity' | 'gaming' | 'accessibility';
    icon: LucideIcon;
};

const PILLARS: Pillar[] = [
    { key: 'identity', icon: Fingerprint },
    { key: 'gaming', icon: Gamepad2 },
    { key: 'accessibility', icon: Hand },
];

function PillarsStrip() {
    const { t } = useTranslation();

    return (
        <section
            aria-label="Vout"
            className="grid gap-3 sm:grid-cols-3"
        >
            {PILLARS.map(({ key, icon: Icon }) => (
                <div
                    key={key}
                    className="group/pillar relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card/80 hover:shadow-md"
                >
                    {/* Subtle hover glow */}
                    <div
                        className="pointer-events-none absolute -top-10 -right-10 size-24 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover/pillar:opacity-100"
                        aria-hidden="true"
                    />
                    <div className="relative flex items-start gap-3">
                        <div
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover/pillar:scale-105"
                            aria-hidden="true"
                        >
                            <Icon className="size-4.5" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-semibold tracking-tight">
                                {t(`welcome.pillars.${key}.title`)}
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                {t(`welcome.pillars.${key}.description`)}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </section>
    );
}
