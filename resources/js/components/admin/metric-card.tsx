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

const toneRing: Record<Tone, string> = {
    default: 'ring-border/60',
    primary: 'ring-primary/30',
    success: 'ring-emerald-500/30',
    warning: 'ring-amber-500/40',
    danger: 'ring-destructive/40',
};

const toneIcon: Record<Tone, string> = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    danger: 'bg-destructive/10 text-destructive',
};

/**
 * Tarjeta compacta de métrica para el Dashboard admin. Muestra una
 * etiqueta, un valor grande tabular y un icono temático. Diseñada para
 * grids responsive — no intenta abarcar toda la altura del contenedor.
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
                'group relative flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm ring-1 transition-colors',
                'hover:border-border hover:shadow-md',
                toneRing[tone],
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </p>
                <span
                    className={cn(
                        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
                        toneIcon[tone],
                    )}
                    aria-hidden
                >
                    <Icon className="size-4" />
                </span>
            </div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
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
