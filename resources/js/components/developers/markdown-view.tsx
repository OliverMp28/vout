import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

import 'highlight.js/styles/github-dark.css';

type MarkdownViewProps = {
    content: string;
    className?: string;
};

/**
 * Renderizador de markdown para las guías del Developer Portal.
 *
 * - GFM: tablas, checklists, strikethrough.
 * - `rehype-highlight`: syntax highlighting sin plugin de bundler extra
 *   (tema GitHub Dark importado al chunk de este componente; code-splitting
 *   evita cargarlo en páginas que no lo usan).
 * - Overrides de componentes: tipografía alineada con la paleta/escala de Vout
 *   sin depender de `@tailwindcss/typography`, que arrastra su propia paleta.
 */
export function MarkdownView({ content, className }: MarkdownViewProps) {
    return (
        <div
            className={cn(
                'vout-markdown max-w-none text-[0.95rem] leading-relaxed text-foreground/90',
                className,
            )}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

const markdownComponents: Components = {
    h1: ({ className, ...props }) => (
        <h1
            className={cn(
                'mt-8 scroll-mt-24 text-3xl font-semibold tracking-tight first:mt-0',
                className,
            )}
            {...props}
        />
    ),
    h2: ({ className, ...props }) => (
        <h2
            className={cn(
                'mt-10 scroll-mt-24 border-b border-border/60 pb-2 text-2xl font-semibold tracking-tight',
                className,
            )}
            {...props}
        />
    ),
    h3: ({ className, ...props }) => (
        <h3
            className={cn(
                'mt-8 scroll-mt-24 text-xl font-semibold tracking-tight',
                className,
            )}
            {...props}
        />
    ),
    h4: ({ className, ...props }) => (
        <h4
            className={cn(
                'mt-6 scroll-mt-24 text-lg font-medium tracking-tight',
                className,
            )}
            {...props}
        />
    ),
    p: ({ className, ...props }) => (
        <p className={cn('mt-4 leading-7', className)} {...props} />
    ),
    a: ({ className, href, ...props }) => {
        const isExternal =
            typeof href === 'string' && /^https?:\/\//.test(href);

        return (
            <a
                href={href}
                className={cn(
                    'font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary',
                    className,
                )}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                {...props}
            />
        );
    },
    ul: ({ className, ...props }) => (
        <ul
            className={cn(
                'mt-4 ml-6 list-disc space-y-2 marker:text-primary/60',
                className,
            )}
            {...props}
        />
    ),
    ol: ({ className, ...props }) => (
        <ol
            className={cn(
                'mt-4 ml-6 list-decimal space-y-2 marker:text-primary/60',
                className,
            )}
            {...props}
        />
    ),
    li: ({ className, ...props }) => (
        <li className={cn('leading-7', className)} {...props} />
    ),
    blockquote: ({ className, ...props }) => (
        <blockquote
            className={cn(
                'mt-6 border-l-4 border-primary/60 bg-muted/40 px-4 py-2 text-muted-foreground italic',
                className,
            )}
            {...props}
        />
    ),
    hr: ({ className, ...props }) => (
        <hr className={cn('my-10 border-border/60', className)} {...props} />
    ),
    table: ({ className, ...props }) => (
        <div className="mt-6 w-full overflow-x-auto rounded-lg border border-border/60">
            <table
                className={cn('w-full text-left text-sm', className)}
                {...props}
            />
        </div>
    ),
    thead: ({ className, ...props }) => (
        <thead
            className={cn('bg-muted/60 text-muted-foreground', className)}
            {...props}
        />
    ),
    th: ({ className, ...props }) => (
        <th
            className={cn(
                'px-4 py-2 font-semibold whitespace-nowrap',
                className,
            )}
            {...props}
        />
    ),
    td: ({ className, ...props }) => (
        <td
            className={cn(
                'border-t border-border/60 px-4 py-2 align-top',
                className,
            )}
            {...props}
        />
    ),
    // Inline code — `rehype-highlight` no marca `code` inline con hljs,
    // así que lo detectamos por la ausencia de className `language-*`.
    code: ({ className, children, ...props }) => {
        const isBlock =
            typeof className === 'string' && className.includes('language-');

        if (isBlock) {
            return (
                <code
                    className={cn(className, 'font-mono text-[0.9em]')}
                    {...props}
                >
                    {children}
                </code>
            );
        }

        return (
            <code
                className={cn(
                    'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground',
                    className,
                )}
                {...props}
            >
                {children}
            </code>
        );
    },
    pre: ({ className, ...props }) => (
        <pre
            className={cn(
                'mt-6 overflow-x-auto rounded-xl border border-border/60 bg-[#0d1117] p-4 text-sm shadow-sm',
                className,
            )}
            {...props}
        />
    ),
    img: ({ className, alt, ...props }) => (
        <img
            alt={alt ?? ''}
            loading="lazy"
            className={cn('mt-6 rounded-lg border border-border/60', className)}
            {...props}
        />
    ),
};
