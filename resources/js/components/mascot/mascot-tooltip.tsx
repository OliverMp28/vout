import { cn } from '@/lib/utils';

type Props = {
    message: string;
    open: boolean;
};

/**
 * Burbuja de saludo que emerge sobre la mascota al click.
 * Posicionada absolutamente respecto al wrapper `.vou-mascot`.
 * `role="status"` + `aria-live="polite"` para que lectores de pantalla
 * anuncien el mensaje sin robar el foco.
 */
export function MascotTooltip({ message, open }: Props) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cn(
                'pointer-events-none absolute right-0 bottom-full mb-3 origin-bottom-right rounded-xl border border-border/60 bg-popover px-3 py-1.5 text-xs font-medium whitespace-nowrap text-popover-foreground shadow-md transition-all duration-200 ease-out',
                open
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'translate-y-1 scale-95 opacity-0',
            )}
        >
            {message}
        </div>
    );
}
