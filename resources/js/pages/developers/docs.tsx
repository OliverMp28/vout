import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Globe } from 'lucide-react';
import type { ReactNode } from 'react';
import { MarkdownView } from '@/components/developers/markdown-view';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { landing } from '@/routes/developers';
import type { DevelopersDocsProps } from '@/types';

/**
 * Visor de markdown para las guías técnicas del Developer Portal.
 *
 * La guía se entrega como string por el controlador (`DevelopersLandingController::docs`),
 * ya validado contra whitelist. El locale activo se resuelve server-side — este
 * componente solo lo muestra como indicador accesible.
 */
export default function DevelopersDocs({
    title_key,
    markdown,
    locale,
    available_locales,
}: DevelopersDocsProps) {
    const { t } = useTranslation();
    const title = t(title_key);

    return (
        <>
            <Head title={title} />

            <article className="space-y-8">
                <header className="space-y-6 border-b border-border/60 pb-8">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Link href={landing().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('developers.docs.back')}
                        </Link>
                    </Button>

                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
                            {title}
                        </h1>

                        {available_locales.length > 1 && (
                            <LocaleIndicator
                                locale={locale}
                                available={available_locales}
                                label={t('developers.docs.locale_label')}
                                labels={{
                                    es: t('developers.docs.locale.es'),
                                    en: t('developers.docs.locale.en'),
                                }}
                            />
                        )}
                    </div>
                </header>

                <MarkdownView content={markdown} />

                <footer className="border-t border-border/60 pt-8">
                    <Button asChild variant="ghost" className="gap-1.5">
                        <Link href={landing().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('developers.docs.back')}
                        </Link>
                    </Button>
                </footer>
            </article>
        </>
    );
}

DevelopersDocs.layout = (page: ReactNode) => (
    <DevelopersLayout showSubnav={false}>{page}</DevelopersLayout>
);

type LocaleIndicatorProps = {
    locale: string;
    available: readonly string[];
    label: string;
    labels: Readonly<Record<string, string>>;
};

/**
 * Muestra el locale actual del documento. El cambio global se hace vía
 * el selector de idioma del header, que fuerza una recarga a nivel de
 * aplicación — aquí solo informamos.
 */
function LocaleIndicator({
    locale,
    available,
    label,
    labels,
}: LocaleIndicatorProps) {
    return (
        <div
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
            role="status"
            aria-label={`${label}: ${labels[locale] ?? locale}`}
        >
            <Globe className="size-3.5" aria-hidden />
            <span className="font-medium">{label}:</span>
            <span>{labels[locale] ?? locale}</span>
            {available.length > 1 && (
                <span className="text-muted-foreground/60">
                    ({available.length})
                </span>
            )}
        </div>
    );
}
