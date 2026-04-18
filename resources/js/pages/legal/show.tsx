import { Head, Link } from '@inertiajs/react';
import { Calendar, FileText, Globe, ShieldCheck, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import { MarkdownView } from '@/components/developers/markdown-view';
import { useTranslation } from '@/hooks/use-translation';
import PortalLayout from '@/layouts/portal-layout';
import { cn } from '@/lib/utils';
import { show as legalShow } from '@/routes/legal';
import type { LegalShowProps } from '@/types';

/**
 * Visor de páginas legales (Fase 5).
 *
 * Reutiliza `MarkdownView` del Developer Portal para no duplicar el pipeline
 * de render. El sidebar de navegación entre los 4 documentos se presenta
 * como columna en desktop y como chips horizontales en móvil — así la
 * interfaz se mantiene no intrusiva.
 */
export default function LegalShow({
    slug,
    title_key,
    markdown,
    version,
    last_updated,
    locale,
    available_locales,
    documents,
}: LegalShowProps) {
    const { t } = useTranslation();
    const title = t(title_key);

    const localeLabels: Record<string, string> = {
        es: t('legal.locale.es'),
        en: t('legal.locale.en'),
    };

    return (
        <>
            <Head title={title} />

            <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
                <LegalSidebar
                    documents={documents}
                    currentSlug={slug}
                    label={t('legal.sidebar.label')}
                    translate={t}
                />

                <article className="min-w-0 space-y-8">
                    <header className="space-y-4 border-b border-border/60 pb-8">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            <ShieldCheck className="size-3.5" aria-hidden />
                            {t('legal.eyebrow')}
                        </div>

                        <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
                            {title}
                        </h1>

                        <MetadataRow
                            version={version}
                            lastUpdated={last_updated}
                            locale={locale}
                            availableLocales={available_locales}
                            labels={{
                                version: t('legal.meta.version'),
                                last_updated: t('legal.meta.last_updated'),
                                locale_label: t('legal.meta.locale'),
                                localeLabels,
                            }}
                        />
                    </header>

                    <MarkdownView content={markdown} />

                    <footer className="rounded-xl border border-border/60 bg-muted/30 p-6">
                        <p className="text-sm text-muted-foreground">
                            {t('legal.footer.contact')}
                        </p>
                    </footer>
                </article>
            </div>
        </>
    );
}

LegalShow.layout = (page: ReactNode) => <PortalLayout>{page}</PortalLayout>;

type LegalSidebarProps = {
    documents: LegalShowProps['documents'];
    currentSlug: string;
    label: string;
    translate: (key: string) => string;
};

/**
 * Navegación entre documentos legales.
 *
 * Desktop: columna fija a la izquierda.
 * Móvil: fila de chips horizontal con scroll. Así no roba espacio ni obliga
 * al usuario a abrir un menú para cambiar de documento.
 */
function LegalSidebar({
    documents,
    currentSlug,
    label,
    translate,
}: LegalSidebarProps) {
    return (
        <nav aria-label={label} className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">
                {label}
            </p>

            <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
                {documents.map((doc) => {
                    const active = doc.slug === currentSlug;

                    return (
                        <li key={doc.slug} className="shrink-0 lg:shrink">
                            <Link
                                href={legalShow(doc.slug).url}
                                prefetch
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    'lg:w-full',
                                    active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                <FileText className="size-4 shrink-0" aria-hidden />
                                <span className="truncate">{translate(doc.title_key)}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

type MetadataRowProps = {
    version: string | null;
    lastUpdated: string | null;
    locale: string;
    availableLocales: readonly string[];
    labels: {
        version: string;
        last_updated: string;
        locale_label: string;
        localeLabels: Record<string, string>;
    };
};

function MetadataRow({
    version,
    lastUpdated,
    locale,
    availableLocales,
    labels,
}: MetadataRowProps) {
    const items: { icon: typeof Tag; label: string; value: string }[] = [];

    if (version) {
        items.push({ icon: Tag, label: labels.version, value: version });
    }
    if (lastUpdated) {
        items.push({
            icon: Calendar,
            label: labels.last_updated,
            value: formatDate(lastUpdated, locale),
        });
    }
    if (availableLocales.length > 1) {
        items.push({
            icon: Globe,
            label: labels.locale_label,
            value: labels.localeLabels[locale] ?? locale,
        });
    }

    if (items.length === 0) {
        return null;
    }

    return (
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.label}
                        className="inline-flex items-center gap-1.5"
                    >
                        <Icon className="size-3.5" aria-hidden />
                        <dt className="font-medium">{item.label}:</dt>
                        <dd>{item.value}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

/**
 * Formatea una fecha ISO-8601 `YYYY-MM-DD` al locale solicitado.
 * Cae al string original si el valor no es parseable — preferimos mostrar
 * algo que fallar silenciosamente.
 */
function formatDate(iso: string, locale: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date);
    } catch {
        return iso;
    }
}
