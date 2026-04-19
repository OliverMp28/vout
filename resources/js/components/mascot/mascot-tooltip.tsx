import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MascotTone } from '@/types/mascot';

type Progress = {
    readonly current: number;
    readonly total: number;
};

type Props = {
    message: string;
    open: boolean;
    tone?: MascotTone;
    /**
     * Badge de progreso para el modo `guide` (S8). Muestra "n/total" junto
     * al texto. Si se pasa, el tooltip también se marca con
     * `data-variant="guide"` para que los tests puedan localizar la guía.
     */
    progress?: Progress | null;
};

/**
 * Burbuja que emerge sobre la mascota. Funciona en tres modos:
 * - Saludo/contextual (tone `info`): estilo neutro.
 * - Notificación (tone `success`/`error`): icono + tono visual + `aria-live`
 *   más asertivo para errores.
 * - Guide (S8): igual que `info` pero con badge de progreso. La persistencia
 *   (no autocierre) la decide el llamador manteniendo `open=true`.
 *
 * Posicionada absolutamente respecto al wrapper `.vou-mascot`.
 */
export function MascotTooltip({
    message,
    open,
    tone = 'info',
    progress = null,
}: Props) {
    const ariaLive = tone === 'error' ? 'assertive' : 'polite';
    const Icon =
        tone === 'success'
            ? CheckCircle2
            : tone === 'error'
              ? AlertCircle
              : null;

    return (
        <div
            role="status"
            aria-live={ariaLive}
            aria-atomic="true"
            data-tone={tone}
            data-variant={progress ? 'guide' : 'default'}
            className={cn(
                'pointer-events-none absolute right-0 bottom-full mb-3 flex origin-bottom-right items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-md transition-all duration-200 ease-out',
                tone === 'success' &&
                    'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
                tone === 'error' &&
                    'border-destructive/30 bg-destructive/10 text-destructive',
                tone === 'info' &&
                    'border-border/60 bg-popover text-popover-foreground',
                open
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'translate-y-1 scale-95 opacity-0',
            )}
        >
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
            <span>{message}</span>
            {progress ? (
                <span
                    data-test="mascot-guide-progress"
                    className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary"
                    aria-label={`${progress.current} / ${progress.total}`}
                >
                    {progress.current}/{progress.total}
                </span>
            ) : null}
        </div>
    );
}
