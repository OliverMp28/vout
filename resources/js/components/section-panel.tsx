import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionPanelProps = Omit<ComponentProps<'section'>, 'title'> & {
    title: string;
    description?: ReactNode;
    /**
     * `attention` marca lo que espera una decisión (borde y luz de señal);
     * `danger`, acciones que no se pueden deshacer.
     */
    tone?: 'default' | 'attention' | 'danger';
    /** Algo pequeño a la derecha del título (una insignia, un enlace). */
    aside?: ReactNode;
    /** Id del título, si otro elemento lo usa en `aria-labelledby`. */
    headingId?: string;
};

/**
 * Bandeja de sección (ajustes, fichas de desarrollador y de admin): el título
 * arriba, separado del contenido por una línea. Las partes de dentro se
 * separan con líneas (`SectionRow`), no con otra tarjeta.
 */
export function SectionPanel({
    title,
    description,
    tone = 'default',
    aside,
    headingId: givenHeadingId,
    className,
    children,
    ...props
}: SectionPanelProps) {
    const generatedHeadingId = useId();
    const headingId = givenHeadingId ?? generatedHeadingId;

    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                'rounded-surface border bg-surface-1 shadow-surface',
                tone === 'danger' && 'border-danger/45',
                tone === 'attention' && 'border-signal-edge',
                className,
            )}
            {...props}
        >
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-5 py-4 md:px-6">
                <div className="min-w-0 space-y-1">
                    <h2
                        id={headingId}
                        className={cn(
                            'flex items-center gap-2 text-base leading-tight font-bold',
                            tone === 'danger' && 'text-danger-text',
                        )}
                    >
                        {tone === 'attention' && (
                            <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-[2px] bg-signal-edge"
                            />
                        )}
                        {title}
                    </h2>
                    {description && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {aside}
            </header>
            <div className="px-5 py-5 md:px-6">{children}</div>
        </section>
    );
}

/**
 * Fila de datos dentro de una sección: etiqueta y explicación a la izquierda,
 * valor o acción a la derecha. Las filas seguidas se separan con una línea.
 */
export function SectionRow({
    label,
    description,
    children,
    className,
}: {
    label: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 border-t py-4 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between',
                className,
            )}
        >
            <div className="min-w-0 space-y-0.5">
                <p className="font-semibold">{label}</p>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {children && <div className="shrink-0">{children}</div>}
        </div>
    );
}
