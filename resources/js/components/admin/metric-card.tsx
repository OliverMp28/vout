import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

type MetricCardProps = {
    label: string;
    value: number | string;
    tone?: Tone;
    hint?: string;
    action?: ReactNode;
};

/** Luz de la esquina: el tono solo marca lo que pide atención. */
const toneLight: Record<Tone, string> = {
    default: 'bg-led-off',
    primary: 'bg-signal-edge',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
};

/**
 * Una celda del cuadro de métricas del admin: luz y etiqueta pixel arriba y la
 * cifra en mono. Va dentro de `MetricGrid`, que dibuja las líneas entre
 * celdas; el tono se ve en la luz, no en el fondo.
 */
export function MetricCard({
    label,
    value,
    tone = 'default',
    hint,
    action,
}: MetricCardProps) {
    return (
        <div className="flex min-h-28 flex-col gap-2 bg-card p-4 md:p-5">
            <dt className="flex items-center gap-2 font-pixel-label text-base leading-none text-muted-foreground">
                <span
                    className={cn(
                        'size-2 shrink-0 rounded-[2px]',
                        toneLight[tone],
                    )}
                    aria-hidden
                />
                {label}
            </dt>
            <dd className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                {value}
            </dd>
            {(hint || action) && (
                <dd className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {hint && <span className="truncate">{hint}</span>}
                    {action}
                </dd>
            )}
        </div>
    );
}

/** Cuadro de métricas: una bandeja con las celdas separadas por líneas. */
export function MetricGrid({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <dl
            aria-label={label}
            className="grid grid-cols-2 gap-px overflow-hidden rounded-surface border bg-border shadow-surface lg:grid-cols-4"
        >
            {children}
        </dl>
    );
}
