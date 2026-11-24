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
        // Siempre en oscuro (la clase `dark` cambia los tokens de esta zona):
        // es la "consola" para quien integra, con la rejilla de plano detrás.
        <section
            aria-labelledby="developers-hero-heading"
            className="dark relative overflow-hidden rounded-surface border bg-background text-foreground shadow-overlay"
        >
            <div aria-hidden className="bg-blueprint absolute inset-0" />

            <div className="relative flex items-center gap-3 border-b bg-surface-1/80 px-5 py-2.5">
                <span className="size-2 rounded-[2px] bg-success" />
                <span className="font-pixel-label text-lg leading-none">
                    Vout · API
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                    OAuth 2.1 · postMessage
                </span>
            </div>

            <div className="relative grid items-center gap-10 px-6 py-12 md:px-10 md:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
                <div className="flex flex-col items-start gap-5">
                    <p className="font-pixel-label text-xl leading-none text-signal-strong">
                        {eyebrow}
                    </p>

                    <h1
                        id="developers-hero-heading"
                        className="text-3xl leading-[1.08] font-extrabold tracking-tight text-balance md:text-5xl"
                    >
                        {title}
                    </h1>

                    <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                        {subtitle}
                    </p>

                    <ul
                        className="flex flex-wrap gap-2 font-mono text-xs"
                        aria-label="Stack técnico"
                    >
                        {['OAuth 2.1', 'PKCE', 'JWT RS256', 'postMessage'].map(
                            (tag) => (
                                <li
                                    key={tag}
                                    className="inline-flex items-center gap-1.5 rounded-sm border bg-surface-1 px-2 py-1"
                                >
                                    <span
                                        className="size-1.5 rounded-[2px] bg-signal-edge"
                                        aria-hidden
                                    />
                                    {tag}
                                </li>
                            ),
                        )}
                    </ul>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Button
                            asChild
                            id="btn-developers-landing-primary-cta"
                            size="lg"
                            variant="play"
                        >
                            <Link href={primaryHref}>
                                {primaryLabel}
                                <ArrowRight aria-hidden />
                            </Link>
                        </Button>
                        {secondaryHref && (
                            <Button
                                asChild
                                id="btn-developers-landing-secondary-cta"
                                size="lg"
                                variant="secondary"
                            >
                                <Link href={secondaryHref} prefetch>
                                    <BookOpen aria-hidden />
                                    {secondaryLabel}
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-4" aria-hidden>
                    <HeroCodePreview />
                    <HandshakeLog />
                </div>
            </div>
        </section>
    );
}

/**
 * Lo que recibe el backend de un juego tras "Entrar con Vout": el contenido
 * de un token real. Es lo más útil que se le puede enseñar a quien integra.
 */
function HeroCodePreview() {
    const key = 'text-(--code-key)';
    const value = 'text-(--code-string)';
    const punct = 'text-(--code-muted)';
    const fields: Array<[string, string]> = [
        ['iss', '"https://vout.app"'],
        ['sub', '"01HC8K...e2f"'],
        ['aud', '"your-app"'],
        ['scope', '"user:read"'],
        ['exp', '1712998800'],
    ];

    return (
        <div className="overflow-hidden rounded-surface border bg-(--code-bg) text-(--code-fg)">
            <div className="flex items-center gap-2 border-b border-(--code-border) px-4 py-2">
                <span className="font-pixel-label text-base leading-none text-(--code-muted)">
                    jwt.payload
                </span>
            </div>
            <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-[1.7]">
                <code>
                    <span className={punct}>
                        {'// Authorization: Bearer <token>'}
                    </span>
                    {'\n'}
                    <span>{'{'}</span>
                    {fields.map(([name, data], index) => (
                        <span key={name}>
                            {'\n  '}
                            <span className={key}>&quot;{name}&quot;</span>
                            <span className={punct}>: </span>
                            <span className={value}>{data}</span>
                            {index < fields.length - 1 && (
                                <span className={punct}>,</span>
                            )}
                        </span>
                    ))}
                    {'\n'}
                    <span>{'}'}</span>
                </code>
            </pre>
        </div>
    );
}

/**
 * El intercambio de mensajes con un juego embebido, tal cual: lo que el
 * juego manda, lo que Vout contesta y cómo llega un gesto.
 */
function HandshakeLog() {
    const rows: Array<{ dir: '←' | '→'; type: string; detail: string }> = [
        { dir: '←', type: 'READY', detail: 'game' },
        { dir: '→', type: 'VOUT_AUTH', detail: 'token · 60 min' },
        { dir: '→', type: 'VOUT_ACTION', detail: 'JUMP · brows up' },
        { dir: '→', type: 'VOUT_KEY', detail: 'Space' },
    ];

    return (
        <ol className="divide-y divide-(--code-border) overflow-hidden rounded-surface border bg-(--code-bg) font-mono text-xs text-(--code-fg)">
            {rows.map((row) => (
                <li
                    key={row.type}
                    className="grid grid-cols-[auto_auto_1fr] items-center gap-3 px-4 py-2"
                >
                    <span className="text-(--code-muted)">{row.dir}</span>
                    <span className="text-(--code-key)">{row.type}</span>
                    <span className="truncate text-right text-(--code-muted)">
                        {row.detail}
                    </span>
                </li>
            ))}
        </ol>
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
                    className="text-2xl font-extrabold tracking-tight md:text-3xl"
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

function FeatureCard({
    icon: Icon,
    title,
    description,
    delay,
}: FeatureCardProps) {
    return (
        <article
            className="group shadow-surfaced relative overflow-hidden rounded-surface border bg-card p-6 md:p-7"
            style={delay ? { animationDelay: delay } : undefined}
        >
            <span
                className="mb-4 inline-flex size-11 items-center justify-center rounded-control bg-surface-sunken text-foreground"
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
                    className="text-2xl font-extrabold tracking-tight md:text-3xl"
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
                        description={t(
                            `developers.landing.steps.step_${step}.desc`,
                        )}
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
        <li className="group relative h-full rounded-surface border bg-card p-6 shadow-surface">
            <span
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-control border border-border-strong bg-key-light px-2 font-pixel text-xl leading-none shadow-[0_2px_0_0_var(--key-light-edge)]"
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
                    className="text-2xl font-extrabold tracking-tight md:text-3xl"
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
                    guides.length === 1
                        ? 'md:mx-auto md:max-w-2xl'
                        : 'md:grid-cols-2',
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
            className="group flex items-center justify-between gap-6 rounded-surface border bg-card p-6 shadow-surface transition-[border-color,transform] hover:-translate-y-0.5 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            <div className="flex items-start gap-4">
                <span
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-foreground"
                    aria-hidden
                >
                    <BookOpen className="size-5" />
                </span>
                <div className="space-y-1">
                    <h3 className="text-base font-semibold tracking-tight">
                        {title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold underline decoration-border-strong underline-offset-4 group-hover:decoration-signal-strong">
                        {cta}
                    </span>
                </div>
            </div>
            <ArrowRight
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
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
                    className="text-2xl font-extrabold tracking-tight md:text-3xl"
                >
                    {t('developers.landing.faq.heading')}
                </h2>
            </header>

            <div className="divide-y rounded-surface border bg-card shadow-surface">
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
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-muted/40">
                <span className="text-sm font-medium md:text-base">
                    {question}
                </span>
                <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
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

function FinalCtaSection({
    heading,
    description,
    cta,
    href,
}: FinalCtaSectionProps) {
    return (
        <section
            aria-labelledby="developers-final-cta-heading"
            className="rounded-surface border bg-surface-sunken px-6 py-12 text-center md:px-12 md:py-14"
        >
            <div className="relative z-10 mx-auto max-w-2xl space-y-4">
                <CheckCircle2
                    aria-hidden
                    className="mx-auto size-10 text-muted-foreground"
                />
                <h2
                    id="developers-final-cta-heading"
                    className="text-2xl font-extrabold tracking-tight text-balance md:text-3xl"
                >
                    {heading}
                </h2>
                <p className="text-sm text-muted-foreground md:text-base">
                    {description}
                </p>
                <div className="pt-2">
                    <Button
                        asChild
                        id="btn-developers-landing-final-cta"
                        size="lg"
                        className="group/cta"
                    >
                        <Link href={href}>
                            {cta}
                            <ArrowRight
                                className="ml-2 size-4 transition-transform group-hover/cta:translate-x-0.5"
                                aria-hidden
                            />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
