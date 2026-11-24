import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

type MetricCardProps = {
    label: string;
    value: number | string;
    icon: LucideIcon;
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
 * Tarjeta compacta de métrica para el panel de admin: etiqueta pixel, cifra
 * grande en mono y un icono. El tono se ve en la luz de la esquina, no en el
 * fondo, para que el panel no se llene de colores.
 */
export function MetricCard({
    label,
    value,
    icon: Icon,
    tone = 'default',
    hint,
    action,
}: MetricCardProps) {
    return (
        <div
            className={cn(
                'group relative flex flex-col gap-3 rounded-surface border bg-card p-5 shadow-surface transition-colors',
                'hover:border-border-strong',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 font-pixel-label text-base leading-none text-muted-foreground">
                    <span
                        className={cn('size-2 rounded-[2px]', toneLight[tone])}
                        aria-hidden
                    />
                    {label}
                </p>
                <span
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-muted-foreground"
                    aria-hidden
                >
                    <Icon className="size-4" />
                </span>
            </div>
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                {value}
            </p>
            {(hint || action) && (
                <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {hint && <span className="truncate">{hint}</span>}
                    {action}
                </div>
            )}
        </div>
    );
}
