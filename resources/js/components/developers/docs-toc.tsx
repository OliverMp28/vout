import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { slugify } from './markdown-view';

type TocEntry = {
    level: 2 | 3;
    text: string;
    slug: string;
};

type DocsTableOfContentsProps = {
    /**
     * El markdown completo de la guía. La TOC se calcula a partir de él
     * en lugar del DOM porque el componente puede montar antes de que
     * `react-markdown` termine de renderizar el árbol final.
     */
    content: string;
};

/**
 * Tabla de contenidos lateral para el visor de documentación.
 *
 * - Extrae los `## ` y `### ` del markdown ignorando los que aparecen
 *   dentro de bloques de código triple-backtick (un `## ` dentro de un
 *   ejemplo de YAML, por ejemplo, no es un heading real).
 * - El `slug` se genera con la misma función que el `<h2>/<h3>` de
 *   `MarkdownView`, así que los anchors siempre encajan.
 * - Resalta la sección visible usando `IntersectionObserver` con un
 *   margen superior que tiene en cuenta el header sticky del portal.
 */
export function DocsTableOfContents({ content }: DocsTableOfContentsProps) {
    const { t } = useTranslation();
    const entries = useMemo(() => extractEntries(content), [content]);
    const [activeSlug, setActiveSlug] = useState<string | null>(
        entries[0]?.slug ?? null,
    );

    useEffect(() => {
        if (entries.length === 0) {
            return;
        }

        const observer = new IntersectionObserver(
            (intersections) => {
                const visible = intersections
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (a, b) =>
                            a.target.getBoundingClientRect().top -
                            b.target.getBoundingClientRect().top,
                    );

                if (visible.length > 0) {
                    setActiveSlug(visible[0].target.id);
                }
            },
            {
                // El header sticky ocupa ~80px; este margen evita que la
                // sección "activa" se adelante mientras todavía está
                // tapada por el header.
                rootMargin: '-100px 0px -60% 0px',
                threshold: 0,
            },
        );

        const elements: HTMLElement[] = [];
        for (const entry of entries) {
            const el = document.getElementById(entry.slug);
            if (el) {
                observer.observe(el);
                elements.push(el);
            }
        }

        return () => {
            for (const el of elements) {
                observer.unobserve(el);
            }
            observer.disconnect();
        };
    }, [entries]);

    if (entries.length === 0) {
        return null;
    }

    return (
        <nav
            aria-label={t('developers.docs.toc.label')}
            className="text-sm"
        >
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t('developers.docs.toc.title')}
            </p>
            <ul className="space-y-1 border-l border-border/60">
                {entries.map((entry) => {
                    const isActive = entry.slug === activeSlug;
                    return (
                        <li key={entry.slug}>
                            <a
                                href={`#${entry.slug}`}
                                className={cn(
                                    '-ml-px block border-l-2 py-1 transition-colors',
                                    entry.level === 3 ? 'pl-6' : 'pl-3',
                                    isActive
                                        ? 'border-primary text-foreground font-medium'
                                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                                )}
                                aria-current={isActive ? 'location' : undefined}
                            >
                                {entry.text}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/**
 * Recorre el markdown línea a línea y extrae headings de nivel 2 y 3
 * que NO estén dentro de un bloque ``` ... ```. Los headings de nivel 1
 * se ignoran porque corresponden al título de la guía (ya hay un H1
 * fuera del markdown en el visor).
 */
function extractEntries(content: string): TocEntry[] {
    const result: TocEntry[] = [];
    let inCodeBlock = false;

    for (const rawLine of content.split('\n')) {
        const line = rawLine.trimEnd();

        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) {
            continue;
        }

        const match = line.match(/^(#{2,3})\s+(.+)$/);
        if (!match) {
            continue;
        }

        const level = match[1].length === 2 ? 2 : 3;
        // Despoja markdown inline básico (negritas, code inline, enlaces).
        // Es lo único que aparece en headings de la guía actual.
        const text = match[2]
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .trim();

        result.push({
            level: level as 2 | 3,
            text,
            slug: slugify(text),
        });
    }

    return result;
}
