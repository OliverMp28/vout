import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type CopyButtonProps = {
    value: string;
    /**
     * Texto opcional del botón cuando no está en estado "copied".
     * Si no se pasa, sólo se muestra el icono (variante compacta).
     */
    label?: string;
    className?: string;
    variant?: 'default' | 'secondary' | 'ghost' | 'outline';
    size?: 'default' | 'sm' | 'icon';
    /**
     * `aria-label` para la variante icon-only. Ignorado si hay `label`.
     */
    ariaLabel?: string;
};

/**
 * Botón de copia al portapapeles con feedback de 2 s.
 *
 * Seguro ante desmontajes: limpia el timeout en `useEffect` cleanup.
 * Silencioso si el navegador no expone `navigator.clipboard` — el hook
 * `useClipboard` devuelve `false` y no cambiamos el estado visual.
 */
export function CopyButton({
    value,
    label,
    className,
    variant = 'secondary',
    size = 'default',
    ariaLabel,
}: CopyButtonProps) {
    const { t } = useTranslation();
    const [, copy] = useClipboard();
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleClick = async (): Promise<void> => {
        const ok = await copy(value);
        if (!ok) {
            return;
        }

        setCopied(true);

        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setCopied(false);
            timeoutRef.current = null;
        }, 2000);
    };

    const copyText = t('developers.secret.copy');
    const copiedText = t('developers.secret.copied');
    const computedAriaLabel = ariaLabel ?? (copied ? copiedText : copyText);

    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            onClick={handleClick}
            aria-label={label === undefined ? computedAriaLabel : undefined}
            className={cn(className)}
        >
            {copied ? (
                <Check className="size-4" aria-hidden />
            ) : (
                <Copy className="size-4" aria-hidden />
            )}
            {label !== undefined && (
                <span role={copied ? 'status' : undefined}>
                    {copied ? copiedText : label}
                </span>
            )}
        </Button>
    );
}
