import { CameraOff } from 'lucide-react';
import type { RefObject } from 'react';

import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type CameraPreviewProps = {
    /** Ref al elemento <video> subyacente para el motor de visión. */
    ref: RefObject<HTMLVideoElement | null>;
    /** Si la cámara está activa. */
    active: boolean;
    /** Variante compacta para el wizard inline. */
    compact?: boolean;
    className?: string;
};

/**
 * Renderiza un elemento <video> con wrapper estilizado para la webcam.
 *
 * En React 19 el ref se pasa como prop directa, sin forwardRef.
 */
function CameraPreview({
    ref,
    active,
    compact = false,
    className,
}: CameraPreviewProps) {
    const { t } = useTranslation();

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-xl border border-border/50 bg-black/90',
                compact
                    ? 'h-48 w-full max-w-xs'
                    : 'aspect-video w-full max-w-md',
                className,
            )}
        >
            <video
                ref={ref}
                autoPlay
                playsInline
                muted
                className={cn(
                    'h-full w-full object-cover',
                    active ? 'scale-x-[-1]' : 'hidden',
                )}
            />

            {!active && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <CameraOff className="size-8 opacity-40" />
                    <span className="text-xs">
                        {t('vision.camera.inactive')}
                    </span>
                </div>
            )}

            {active && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
                    <span className="size-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-[10px] font-medium text-white">
                        LIVE
                    </span>
                </div>
            )}
        </div>
    );
}

export { CameraPreview };
