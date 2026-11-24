import { ScanFace } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { FacialControlSupport } from '@/types';

type FacialControlBadgeProps = {
    support: FacialControlSupport;
    className?: string;
    /** Texto corto para tarjetas pequeñas ("Gestos" en vez de "Hecho para gestos"). */
    short?: boolean;
};

/**
 * Insignia de un juego que se maneja con gestos. Distingue el juego hecho
 * para los gestos (tinte cian) del que solo los admite (contorno): quien juega
 * con la cámara necesita saber cuáles van de verdad bien. Sin control por
 * gestos no pinta nada.
 */
export function FacialControlBadge({
    support,
    className,
    short = false,
}: FacialControlBadgeProps) {
    const { t } = useTranslation();

    if (support === 'none') {
        return null;
    }

    return (
        <Badge
            variant={support === 'designed' ? 'gesture' : 'outline'}
            data-facial-control={support}
            className={cn('gap-1', className)}
        >
            <ScanFace aria-hidden="true" />
            {short && support === 'designed'
                ? t('facial_control.badge_short.designed')
                : t(`facial_control.badge.${support}`)}
        </Badge>
    );
}
