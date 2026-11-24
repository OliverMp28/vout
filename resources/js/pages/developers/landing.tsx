import { Head, Link } from '@inertiajs/react';
import { ArrowRight, BookOpen, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { register } from '@/routes';
import { dashboard, docs } from '@/routes/developers';
import type { DevelopersLandingProps } from '@/types';

/**
 * Landing pública del Developer Portal: una consola oscura arriba (lo que
 * viaja entre el portal y el juego) y debajo, como en una guía, qué te da
 * Vout, los pasos, la documentación con las preguntas frecuentes y el cierre.
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

            <div className="space-y-16 pb-10 md:space-y-24">
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

                <DocsAndFaqSection t={t} guides={guides} />

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

type Feature = {
    tag: string;
    title: string;
    description: string;
};

/** Encabezado de sección alineado a la izquierda, como en una guía. */
function SectionHeader({
    id,
    title,
    description,
}: {
    id: string;
    title: string;
    description?: string;
}) {
    return (
        <header className="max-w-2xl space-y-2">
            <h2
                id={id}
                className="text-2xl font-extrabold tracking-tight text-balance md:text-3xl"
            >
                {title}
            </h2>
            {description && (
                <p className="text-muted-foreground md:text-lg">
                    {description}
                </p>
            )}
        </header>
    );
}

/**
 * Qué te da Vout: el texto a la izquierda y tres filas separadas por líneas a
 * la derecha, cada una con su etiqueta técnica (lo que de verdad recibe el
 * desarrollador).
 */
function FeaturesSection({ t }: { t: TranslateFn }) {
    const features: readonly Feature[] = [
        {
            tag: 'JWT · RS256',
            title: t('developers.landing.features.identity.title'),
            description: t('developers.landing.features.identity.desc'),
        },
        {
            tag: 'VOUT_KEY · VOUT_ACTION',
            title: t('developers.landing.features.fast.title'),
            description: t('developers.landing.features.fast.desc'),
        },
        {
            tag: 'on-device',
            title: t('developers.landing.features.privacy.title'),
            description: t('developers.landing.features.privacy.desc'),
        },
    ];

    return (
        <section
            aria-labelledby="developers-features-heading"
            className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16"
        >
            <SectionHeader
                id="developers-features-heading"
                title={t('developers.landing.features.heading')}
                description={t('developers.landing.features.intro')}
            />

            <ul className="divide-y rounded-surface border bg-card shadow-surface">
                {features.map((feature) => (
                    <li
                        key={feature.title}
                        className="grid gap-2 px-5 py-5 md:px-6"
                    >
                        <span className="w-fit rounded-xs border bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {feature.tag}
                        </span>
                        <h3 className="text-lg font-bold tracking-tight">
                            {feature.title}
                        </h3>
                        <p className="leading-relaxed text-muted-foreground">
                            {feature.description}
                        </p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Los pasos como una línea con teclas numeradas (en móvil, vertical). Sin
 * tarjetas: el orden lo marca la línea.
 */
function StepsSection({ t }: { t: TranslateFn }) {
    const steps = [1, 2, 3, 4] as const;

    return (
        <section
            aria-labelledby="developers-steps-heading"
            className="space-y-10"
        >
            <SectionHeader
                id="developers-steps-heading"
                title={t('developers.landing.steps.heading')}
                description={t('developers.landing.steps.subheading')}
            />

            <ol className="relative grid gap-8 lg:grid-cols-4 lg:gap-6">
                <span
                    aria-hidden
                    className="absolute top-5 bottom-5 left-5 w-px bg-border-strong lg:top-5 lg:right-5 lg:bottom-auto lg:left-5 lg:h-px lg:w-auto"
                />
                {steps.map((step) => (
                    <li
                        key={step}
                        className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] content-start gap-x-4 lg:grid-cols-1 lg:gap-y-4"
                    >
                        <span
                            aria-hidden
                            className="relative z-10 inline-flex size-10 items-center justify-center rounded-control border border-border-strong bg-key-light font-pixel text-2xl leading-none shadow-[0_3px_0_0_var(--key-light-edge)]"
                        >
                            {step}
                        </span>
                        <div className="space-y-1.5 lg:pr-4">
                            <h3 className="font-bold tracking-tight">
                                {t(
                                    `developers.landing.steps.step_${step}.title`,
                                )}
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {t(
                                    `developers.landing.steps.step_${step}.desc`,
                                )}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/** La documentación y las preguntas frecuentes, lado a lado. */
function DocsAndFaqSection({
    t,
    guides,
}: {
    t: TranslateFn;
    guides: DevelopersLandingProps['guides'];
}) {
    const items = [1, 2, 3, 4] as const;

    return (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
            {guides.length > 0 && (
                <section
                    aria-labelledby="developers-guides-heading"
                    className="space-y-6"
                >
                    <SectionHeader
                        id="developers-guides-heading"
                        title={t('developers.landing.guides.heading')}
                        description={t('developers.landing.guides.subheading')}
                    />
                    <ul className="grid gap-3">
                        {guides.map((guide) => (
                            <li key={guide.slug}>
                                <GuideLink
                                    title={t(guide.title_key)}
                                    href={docs({ slug: guide.slug }).url}
                                    cta={t('developers.landing.guides.cta')}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section
                aria-labelledby="developers-faq-heading"
                className="space-y-6"
            >
                <SectionHeader
                    id="developers-faq-heading"
                    title={t('developers.landing.faq.heading')}
                />
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
        </div>
    );
}

function GuideLink({
    title,
    href,
    cta,
}: {
    title: string;
    href: string;
    cta: string;
}) {
    return (
        <Link
            href={href}
            prefetch
            className="group flex items-center justify-between gap-4 rounded-surface border bg-card px-5 py-4 shadow-surface transition-[border-color,transform] hover:-translate-y-0.5 hover:border-border-strong"
        >
            <span className="flex items-center gap-3">
                <BookOpen
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground"
                />
                <span className="grid">
                    <span className="font-bold">{title}</span>
                    <span className="text-sm text-muted-foreground">{cta}</span>
                </span>
            </span>
            <ArrowRight
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
        </Link>
    );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
    return (
        <Collapsible className="group">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors first:rounded-t-surface hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-surface-sunken">
                <span className="font-semibold">{question}</span>
                <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                    aria-hidden
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
                <p className="px-5 pt-1 pb-5 leading-relaxed text-muted-foreground">
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

/** Cierre: una banda con el texto a la izquierda y la acción a la derecha. */
function FinalCtaSection({
    heading,
    description,
    cta,
    href,
}: FinalCtaSectionProps) {
    return (
        <section
            aria-labelledby="developers-final-cta-heading"
            className="flex flex-col gap-5 rounded-surface border bg-surface-sunken px-6 py-7 sm:flex-row sm:items-center sm:justify-between md:px-8"
        >
            <div className="space-y-1">
                <h2
                    id="developers-final-cta-heading"
                    className="text-xl font-extrabold tracking-tight md:text-2xl"
                >
                    {heading}
                </h2>
                <p className="text-muted-foreground">{description}</p>
            </div>
            <Button
                asChild
                id="btn-developers-landing-final-cta"
                size="lg"
                className="group/cta shrink-0"
            >
                <Link href={href}>
                    {cta}
                    <ArrowRight
                        className="size-4 transition-transform group-hover/cta:translate-x-0.5"
                        aria-hidden
                    />
                </Link>
            </Button>
        </section>
    );
}
