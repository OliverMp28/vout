import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    Fingerprint,
    Gauge,
    ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { cn } from '@/lib/utils';
import { register } from '@/routes';
import { dashboard, docs } from '@/routes/developers';
import type { DevelopersLandingProps } from '@/types';

/**
 * Landing pública del Developer Portal.
 *
 * Mantiene un tono editorial: gradiente de marca confinado al hero y al CTA
 * final, paneles de contenido neutros, y glassmorfismo solo sobre fondo con
 * color. Todo el texto pasa por `t()` para respetar la estrategia i18n
 * flat-key del proyecto.
 */
export default function DevelopersLanding({
    guides,
    is_authenticated,
}: DevelopersLandingProps) {
    const { t } = useTranslation();

    const primaryCtaHref = is_authenticated ? dashboard().url : register().url;
    const primaryCtaLabel = is_authenticated
        ? t('developers.landing.hero.cta_auth')
        : t('developers.landing.hero.cta_guest');
    const finalCtaLabel = is_authenticated
        ? t('developers.landing.final_cta.cta_auth')
        : t('developers.landing.final_cta.cta_guest');

    const integrationGuide =
        guides.find((guide) => guide.slug === 'integration-guide') ?? guides[0];

    return (
        <>
            <Head title={t('developers.landing.hero.eyebrow')} />

            <div className="space-y-20 pb-10 md:space-y-28">
                <HeroSection
                    eyebrow={t('developers.landing.hero.eyebrow')}
                    title={t('developers.landing.hero.title')}
                    subtitle={t('developers.landing.hero.subtitle')}
                    primaryHref={primaryCtaHref}
                    primaryLabel={primaryCtaLabel}
                    secondaryHref={
                        integrationGuide
                            ? docs({ slug: integrationGuide.slug }).url
                            : undefined
                    }
                    secondaryLabel={t('developers.landing.hero.cta_secondary')}
                />

                <FeaturesSection t={t} />

                <StepsSection t={t} />

                <GuidesSection t={t} guides={guides} />

                <FaqSection t={t} />

                <FinalCtaSection
                    heading={t('developers.landing.final_cta.heading')}
                    description={t('developers.landing.final_cta.description')}
                    cta={finalCtaLabel}
                    href={primaryCtaHref}
                />
            </div>
        </>
    );
}

DevelopersLanding.layout = (page: ReactNode) => (
    <DevelopersLayout showSubnav={false}>{page}</DevelopersLayout>
);

type HeroSectionProps = {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref?: string;
    secondaryLabel: string;
};

function HeroSection({
    eyebrow,
    title,
    subtitle,
    primaryHref,
    primaryLabel,
    secondaryHref,
    secondaryLabel,
}: HeroSectionProps) {
    return (
        <section
            aria-labelledby="developers-hero-heading"
            className="relative overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl ring-1 ring-white/10"
        >
            {/* Degradado de marca sobre base slate — más rico y menos lavado que el gradiente plano */}
            <div
                aria-hidden
                className="absolute inset-0 bg-linear-to-br from-(--vout-gradient-start)/80 via-slate-950/40 to-(--vout-gradient-end)/70"
            />

            {/* Resplandores radiales para crear profundidad */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-40 -right-24 size-[32rem] rounded-full bg-violet-500/25 blur-3xl"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -bottom-40 -left-32 size-[28rem] rounded-full bg-fuchsia-500/15 blur-3xl"
            />

            {/* Grid sutil de líneas — vibe "schematic" de producto técnico */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage:
                        'radial-gradient(ellipse at center, black 40%, transparent 75%)',
                    WebkitMaskImage:
                        'radial-gradient(ellipse at center, black 40%, transparent 75%)',
                }}
            />

            <div className="relative z-10 grid items-center gap-10 px-6 py-14 md:px-12 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
                <div className="flex flex-col items-start gap-6">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.07] px-3 py-1 text-xs font-semibold tracking-wider uppercase backdrop-blur-sm">
                        <span
                            className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                            aria-hidden
                        />
                        {eyebrow}
                    </span>

                    <h1
                        id="developers-hero-heading"
                        className="text-3xl leading-[1.05] font-bold tracking-tight text-balance md:text-5xl lg:text-[3.25rem]"
                    >
                        {title}
                    </h1>

                    <p className="max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
                        {subtitle}
                    </p>

                    <ul
                        className="flex flex-wrap gap-2 font-mono text-[11px] tracking-wider text-white/70 uppercase"
                        aria-label="Stack técnico"
                    >
                        {['OAuth 2.1', 'PKCE', 'JWT RS256', 'GDPR-ready'].map((tag) => (
                            <li
                                key={tag}
                                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.05] px-2 py-1 backdrop-blur-sm"
                            >
                                <span className="size-1 rounded-full bg-emerald-400/80" aria-hidden />
                                {tag}
                            </li>
                        ))}
                    </ul>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <Button
                            asChild
                            id="btn-developers-landing-primary-cta"
                            size="lg"
                            className="group/cta bg-white font-semibold text-slate-950 shadow-md transition-all hover:bg-white hover:shadow-lg focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        >
                            <Link href={primaryHref}>
                                {primaryLabel}
                                <ArrowRight
                                    className="ml-2 size-4 transition-transform group-hover/cta:translate-x-0.5"
                                    aria-hidden
                                />
                            </Link>
                        </Button>
                        {secondaryHref && (
                            <Button
                                asChild
                                id="btn-developers-landing-secondary-cta"
                                size="lg"
                                variant="ghost"
                                className="border border-white/20 bg-white/[0.04] text-white backdrop-blur-sm hover:bg-white/[0.09] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                            >
                                <Link href={secondaryHref} prefetch>
                                    <BookOpen className="mr-2 size-4" aria-hidden />
                                    {secondaryLabel}
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                <HeroCodePreview />
            </div>
        </section>
    );
}

/**
 * Preview de JWT payload emitido por Vout. Es el valor educativo más
 * alto que podemos dar a un desarrollador en el hero: en 5 líneas ve
 * qué recibe su backend tras el login y cómo se ve un token real.
 */
function HeroCodePreview() {
    return (
        <div
            className="relative hidden w-full lg:block"
            aria-hidden
        >
            <div
                className="pointer-events-none absolute -inset-4 rounded-2xl bg-linear-to-br from-violet-500/20 via-fuchsia-500/10 to-transparent blur-2xl"
            />
            <div className="relative rounded-xl border border-white/10 bg-slate-950/85 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                    <span className="size-2.5 rounded-full bg-rose-400/70" />
                    <span className="size-2.5 rounded-full bg-amber-400/70" />
                    <span className="size-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ml-3 font-mono text-[11px] tracking-wide text-white/40">
                        jwt.payload
                    </span>
                </div>
                <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.65] text-white/90">
                    <code>
                        <span className="text-white/40">{'// Decoded from Authorization: Bearer <token>'}</span>
                        {'\n'}
                        <span>{'{'}</span>
                        {'\n  '}
                        <span className="text-sky-300">&quot;iss&quot;</span>
                        <span className="text-white/70">: </span>
                        <span className="text-emerald-300">&quot;https://vout.com&quot;</span>
                        <span className="text-white/50">,</span>
                        {'\n  '}
                        <span className="text-sky-300">&quot;sub&quot;</span>
                        <span className="text-white/70">: </span>
                        <span className="text-emerald-300">&quot;01HC8K...e2f&quot;</span>
                        <span className="text-white/50">,</span>
                        {'\n  '}
                        <span className="text-sky-300">&quot;aud&quot;</span>
                        <span className="text-white/70">: </span>
                        <span className="text-emerald-300">&quot;your-app&quot;</span>
                        <span className="text-white/50">,</span>
                        {'\n  '}
                        <span className="text-sky-300">&quot;scope&quot;</span>
                        <span className="text-white/70">: </span>
                        <span className="text-emerald-300">&quot;user:email games:read&quot;</span>
                        <span className="text-white/50">,</span>
                        {'\n  '}
                        <span className="text-sky-300">&quot;exp&quot;</span>
                        <span className="text-white/70">: </span>
                        <span className="text-amber-300">1712998800</span>
                        {'\n'}
                        <span>{'}'}</span>
                    </code>
                </pre>
            </div>
        </div>
    );
}

type TranslateFn = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

type FeatureCardProps = {
    icon: LucideIcon;
    title: string;
    description: string;
    delay?: string;
};

function FeaturesSection({ t }: { t: TranslateFn }) {
    const features: readonly FeatureCardProps[] = [
        {
            icon: Fingerprint,
            title: t('developers.landing.features.identity.title'),
            description: t('developers.landing.features.identity.desc'),
        },
        {
            icon: Gauge,
            title: t('developers.landing.features.fast.title'),
            description: t('developers.landing.features.fast.desc'),
            delay: '0.1s',
        },
        {
            icon: ShieldCheck,
            title: t('developers.landing.features.privacy.title'),
            description: t('developers.landing.features.privacy.desc'),
            delay: '0.2s',
        },
    ];

    return (
        <section
            aria-labelledby="developers-features-heading"
            className="space-y-8"
        >
            <header className="mx-auto max-w-2xl space-y-3 text-center">
                <h2
                    id="developers-features-heading"
                    className="text-2xl font-semibold tracking-tight md:text-3xl"
                >
                    {t('developers.landing.features.heading')}
                </h2>
            </header>

            <div className="grid gap-4 md:grid-cols-3 md:gap-6">
                {features.map((feature) => (
                    <FeatureCard key={feature.title} {...feature} />
                ))}
            </div>
        </section>
    );
}

function FeatureCard({ icon: Icon, title, description, delay }: FeatureCardProps) {
    return (
        <article
            className="group animate-slide-up-fade relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-[box-shadow,background-color] duration-300 ease-out hover:bg-accent/30 hover:shadow-md md:p-7"
            style={delay ? { animationDelay: delay } : undefined}
        >
            <span
                className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
                aria-hidden
            >
                <Icon className="size-5" />
            </span>
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
            </p>
        </article>
    );
}

function StepsSection({ t }: { t: TranslateFn }) {
    const steps = [1, 2, 3, 4] as const;

    return (
        <section
            aria-labelledby="developers-steps-heading"
            className="space-y-8"
        >
            <header className="mx-auto max-w-2xl space-y-3 text-center">
                <h2
                    id="developers-steps-heading"
                    className="text-2xl font-semibold tracking-tight md:text-3xl"
                >
                    {t('developers.landing.steps.heading')}
                </h2>
                <p className="text-sm text-muted-foreground md:text-base">
                    {t('developers.landing.steps.subheading')}
                </p>
            </header>

            <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {steps.map((step) => (
                    <StepCard
                        key={step}
                        number={step}
                        title={t(`developers.landing.steps.step_${step}.title`)}
                        description={t(`developers.landing.steps.step_${step}.desc`)}
                    />
                ))}
            </ol>
        </section>
    );
}

type StepCardProps = {
    number: number;
    title: string;
    description: string;
};

function StepCard({ number, title, description }: StepCardProps) {
    return (
        <li className="group relative h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-[box-shadow,background-color] duration-300 ease-out hover:bg-accent/30 hover:shadow-md">
            <span
                className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 font-mono text-sm font-semibold text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary"
                aria-hidden
            >
                {number.toString().padStart(2, '0')}
            </span>
            <h3 className="mt-4 text-base font-semibold tracking-tight">
                {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
            </p>
        </li>
    );
}

function GuidesSection({
    t,
    guides,
}: {
    t: TranslateFn;
    guides: DevelopersLandingProps['guides'];
}) {
    if (guides.length === 0) {
        return null;
    }

    return (
        <section
            aria-labelledby="developers-guides-heading"
            className="space-y-8"
        >
            <header className="mx-auto max-w-2xl space-y-3 text-center">
                <h2
                    id="developers-guides-heading"
                    className="text-2xl font-semibold tracking-tight md:text-3xl"
                >
                    {t('developers.landing.guides.heading')}
                </h2>
                <p className="text-sm text-muted-foreground md:text-base">
                    {t('developers.landing.guides.subheading')}
                </p>
            </header>

            <div
                className={cn(
                    'grid gap-4 md:gap-6',
                    guides.length === 1 ? 'md:mx-auto md:max-w-2xl' : 'md:grid-cols-2',
                )}
            >
                {guides.map((guide) => (
                    <GuideCard
                        key={guide.slug}
                        title={t(guide.title_key)}
                        href={docs({ slug: guide.slug }).url}
                        cta={t('developers.landing.guides.cta')}
                    />
                ))}
            </div>
        </section>
    );
}

type GuideCardProps = {
    title: string;
    href: string;
    cta: string;
};

function GuideCard({ title, href, cta }: GuideCardProps) {
    return (
        <Link
            href={href}
            prefetch
            className="group flex items-center justify-between gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm transition-[box-shadow,background-color] duration-300 ease-out hover:bg-accent/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            <div className="flex items-start gap-4">
                <span
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
                    aria-hidden
                >
                    <BookOpen className="size-5" />
                </span>
                <div className="space-y-1">
                    <h3 className="text-base font-semibold tracking-tight">
                        {title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                        {cta}
                    </span>
                </div>
            </div>
            <ArrowRight
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
            />
        </Link>
    );
}

function FaqSection({ t }: { t: TranslateFn }) {
    const items = [1, 2, 3, 4] as const;

    return (
        <section
            aria-labelledby="developers-faq-heading"
            className="mx-auto max-w-3xl space-y-8"
        >
            <header className="space-y-3 text-center">
                <h2
                    id="developers-faq-heading"
                    className="text-2xl font-semibold tracking-tight md:text-3xl"
                >
                    {t('developers.landing.faq.heading')}
                </h2>
            </header>

            <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                {items.map((item) => (
                    <FaqItem
                        key={item}
                        question={t(`developers.landing.faq.q${item}`)}
                        answer={t(`developers.landing.faq.a${item}`)}
                    />
                ))}
            </div>
        </section>
    );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
    return (
        <Collapsible className="group">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted/40">
                <span className="text-sm font-medium md:text-base">
                    {question}
                </span>
                <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-primary"
                    aria-hidden
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
                <p className="px-5 pt-1 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {answer}
                </p>
            </CollapsibleContent>
        </Collapsible>
    );
}

type FinalCtaSectionProps = {
    heading: string;
    description: string;
    cta: string;
    href: string;
};

function FinalCtaSection({ heading, description, cta, href }: FinalCtaSectionProps) {
    return (
        <section
            aria-labelledby="developers-final-cta-heading"
            className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-primary/10 via-background to-accent/10 px-6 py-14 text-center shadow-sm md:px-12 md:py-16"
        >
            <div className="relative z-10 mx-auto max-w-2xl space-y-4">
                <CheckCircle2
                    aria-hidden
                    className="mx-auto size-10 text-primary"
                />
                <h2
                    id="developers-final-cta-heading"
                    className="text-2xl font-semibold tracking-tight text-balance md:text-3xl"
                >
                    {heading}
                </h2>
                <p className="text-sm text-muted-foreground md:text-base">
                    {description}
                </p>
                <div className="pt-2">
                    <Button asChild id="btn-developers-landing-final-cta" size="lg" className="group/cta shadow-md hover:shadow-lg">
                        <Link href={href}>
                            {cta}
                            <ArrowRight className="ml-2 size-4 transition-transform group-hover/cta:translate-x-0.5" aria-hidden />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
