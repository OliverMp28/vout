import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type SecretRevealDialogProps = {
    /**
     * Secret en claro entregado por el backend como flash prop
     * (`created_client_secret`). `null` cierra el diálogo.
     */
    secret: string | null;
    /**
     * `client_id` asociado, útil para mostrar ambos valores juntos
     * y facilitar la copia durante el on-boarding.
     */
    clientId?: string | null;
    /**
     * Callback cuando el usuario cierra el diálogo. El padre debe
     * limpiar el flash (recargar sólo `created_client_secret` vía
     * `router.reload`) para que no vuelva a aparecer en recargas.
     */
    onClose: () => void;
};

/**
 * Diálogo "muéstrame el secreto una única vez".
 *
 * Passport 13 guarda el `client_secret` hasheado — el valor en claro
 * sólo existe en memoria durante la respuesta que lo generó. Este
 * componente se limita a renderizar ese valor una vez y avisa al
 * usuario de que no podrá recuperarlo.
 *
 * Patrones clave:
 *   - El diálogo es controlado: abre mientras `secret` no sea `null`.
 *   - El botón "Copiar" usa la Clipboard API y muestra feedback 2 s.
 *   - Al cerrar se invoca `onClose()` para que el padre recargue la
 *     prop `created_client_secret` y el secret desaparezca del árbol.
 */
export function SecretRevealDialog({
    secret,
    clientId,
    onClose,
}: SecretRevealDialogProps) {
    const { t } = useTranslation();
    const [, copy] = useClipboard();
    const [justCopied, setJustCopied] = useState<'secret' | 'client' | null>(
        null,
    );
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async (
        value: string,
        which: 'secret' | 'client',
    ): Promise<void> => {
        const ok = await copy(value);
        if (!ok) {
            return;
        }

        setJustCopied(which);

        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setJustCopied(null);
            timeoutRef.current = null;
        }, 2000);
    };

    const open = secret !== null;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{t('developers.secret.title')}</DialogTitle>
                    <DialogDescription>
                        {t('developers.secret.description')}
                    </DialogDescription>
                </DialogHeader>

                <Alert variant="default" className="border-destructive/40">
                    <AlertTriangle className="size-4 text-destructive" />
                    <AlertTitle>{t('developers.secret.warning_title')}</AlertTitle>
                    <AlertDescription>
                        {t('developers.secret.warning_body')}
                    </AlertDescription>
                </Alert>

                {clientId !== null && clientId !== undefined && (
                    <CredentialRow
                        label={t('developers.secret.client_id_label')}
                        value={clientId}
                        onCopy={() => handleCopy(clientId, 'client')}
                        copied={justCopied === 'client'}
                        hint={t('developers.secret.copy')}
                        copiedHint={t('developers.secret.copied')}
                    />
                )}

                {secret !== null && (
                    <CredentialRow
                        label={t('developers.secret.secret_label')}
                        value={secret}
                        onCopy={() => handleCopy(secret, 'secret')}
                        copied={justCopied === 'secret'}
                        hint={t('developers.secret.copy')}
                        copiedHint={t('developers.secret.copied')}
                        monospaceClassName="text-destructive"
                    />
                )}

                <DialogFooter>
                    <Button onClick={onClose}>
                        {t('developers.secret.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type CredentialRowProps = {
    label: string;
    value: string;
    onCopy: () => void;
    copied: boolean;
    hint: string;
    copiedHint: string;
    monospaceClassName?: string;
};

function CredentialRow({
    label,
    value,
    onCopy,
    copied,
    hint,
    copiedHint,
    monospaceClassName,
}: CredentialRowProps) {
    return (
        <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
                {label}
            </span>
            <div className="flex items-stretch gap-2">
                <code
                    className={cn(
                        'flex-1 overflow-x-auto rounded-md border border-border bg-muted/60 px-3 py-2 font-mono text-sm break-all',
                        monospaceClassName,
                    )}
                >
                    {value}
                </code>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCopy}
                    aria-label={copied ? copiedHint : hint}
                >
                    {copied ? (
                        <>
                            <Check className="size-4" aria-hidden />
                            <span role="status">{copiedHint}</span>
                        </>
                    ) : (
                        <>
                            <Copy className="size-4" aria-hidden />
                            {hint}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
