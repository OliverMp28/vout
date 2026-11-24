import { Clock, FileText, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { GameStatus } from '@/types';

type StatusBadgeProps = {
    status: GameStatus;
    className?: string;
};

const VARIANT: Record<GameStatus, { icon: typeof Clock; className: string }> = {
    draft: {
        icon: FileText,
        className: 'border-border bg-surface-sunken text-muted-foreground',
    },
    pending_review: {
        icon: Clock,
        className: 'border-warning bg-warning-soft text-warning-text',
    },
    published: {
        icon: ShieldCheck,
        className: 'border-success bg-success-soft text-success-text',
    },
    rejected: {
        icon: XCircle,
        className: 'border-danger bg-danger-soft text-danger-text',
    },
};

/**
 * Badge de estado de moderación de un juego (Fase 4.2).
 *
 * Etiqueta + icono + color por estado, con los tokens de estado
 * (`*-soft` de fondo y `*-text` para el texto: contraste AA comprobado en
 * claro y oscuro por tests/js/design/tokens-contrast.test.ts).
 */
export function GameStatusBadge({ status, className }: StatusBadgeProps) {
    const { t } = useTranslation();
    const variant = VARIANT[status];
    const Icon = variant.icon;

    return (
        <Badge
            className={cn(
                'inline-flex shrink-0 items-center gap-1 text-xs font-semibold',
                variant.className,
                className,
            )}
        >
            <Icon className="size-3" aria-hidden />
            {t(`developers.games.status.${status}`)}
        </Badge>
    );
}
