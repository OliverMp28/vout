import { ScanFace } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { FacialControlSupport } from '@/types';

type FacialControlBadgeProps = {
    support: FacialControlSupport;
    className?: string;
};

/**
 * Insignia de un juego que se puede jugar con la cara. Distingue el juego
 * pensado para el control facial del que solo lo admite: quien juega con la
 * cámara necesita saber cuáles van de verdad bien. Sin control facial no
 * pinta nada.
 */
export function FacialControlBadge({
    support,
    className,
}: FacialControlBadgeProps) {
    const { t } = useTranslation();

    if (support === 'none') {
        return null;
    }

    return (
        <Badge
            variant={support === 'designed' ? 'default' : 'secondary'}
            data-facial-control={support}
            className={cn('gap-1', className)}
        >
            <ScanFace aria-hidden="true" />
            {t(`facial_control.badge.${support}`)}
        </Badge>
    );
}
