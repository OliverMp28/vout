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
        className: 'bg-muted text-muted-foreground border border-border/60',
    },
    pending_review: {
        icon: Clock,
        className:
            'bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:text-amber-400',
    },
    published: {
        icon: ShieldCheck,
        className:
            'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-400',
    },
    rejected: {
        icon: XCircle,
        className:
            'bg-destructive/15 text-destructive border border-destructive/30',
    },
};

/**
 * Badge de estado de moderación de un juego (Fase 4.2).
 *
 * Etiqueta + icono + color por estado. Los colores respetan la paleta
 * semántica (muted/amber/emerald/destructive) para cumplir contraste AA
 * tanto en light como en dark mode.
 */
export function GameStatusBadge({ status, className }: StatusBadgeProps) {
    const { t } = useTranslation();
    const variant = VARIANT[status];
    const Icon = variant.icon;

    return (
        <Badge
            className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tracking-wider uppercase',
                variant.className,
                className,
            )}
        >
            <Icon className="size-3" aria-hidden />
            {t(`developers.games.status.${status}`)}
        </Badge>
    );
}
