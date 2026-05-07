import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

type CopyMarkdownButtonProps = {
    /**
     * El markdown crudo de la guía. Lo copiamos tal cual al portapapeles
     * para que un dev que use ChatGPT/Claude pueda pegarlo sin perder
     * formato (lo que se renderiza en pantalla es HTML — inservible para
     * pasarle a una IA).
     */
    content: string;
};

/**
 * Botón "Copiar Markdown" para el visor de docs.
 *
 * Usa el feedback inline (icono Check + texto cambiado durante 2s) en
 * lugar de un toast porque la app aún no monta `sonner`/`<Toaster />`.
 * Si Clipboard API no está disponible (navegadores muy antiguos o
 * contexto no-seguro), el botón se oculta silenciosamente.
 */
export function CopyMarkdownButton({ content }: CopyMarkdownButtonProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [supported, setSupported] = useState(true);

    useEffect(() => {
        // `navigator.clipboard` solo existe en contextos seguros (HTTPS o
        // localhost). En el resto, ocultamos el botón porque no podemos
        // garantizar el copy.
        if (
            typeof navigator === 'undefined' ||
            !navigator.clipboard?.writeText
        ) {
            setSupported(false);
        }
    }, []);

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timeout = window.setTimeout(() => setCopied(false), 2000);
        return () => window.clearTimeout(timeout);
    }, [copied]);

    if (!supported) {
        return null;
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
        } catch {
            // El usuario denegó el permiso o el navegador rechazó el
            // copy. No mostramos error porque no hay forma de recuperarse
            // y el feedback negativo ruidoso no aporta nada.
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-1.5"
            aria-live="polite"
        >
            {copied ? (
                <>
                    <Check className="size-4" aria-hidden />
                    {t('developers.docs.copy.copied')}
                </>
            ) : (
                <>
                    <Copy className="size-4" aria-hidden />
                    {t('developers.docs.copy.label')}
                </>
            )}
        </Button>
    );
}
