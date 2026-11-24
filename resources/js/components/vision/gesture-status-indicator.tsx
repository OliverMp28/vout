import { useTranslation } from '@/hooks/use-translation';
import type { EngineStatus } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

type GestureStatusIndicatorProps = {
    status: EngineStatus;
    className?: string;
};

const statusConfig: Record<
    EngineStatus,
    { color: string; pulse: boolean; i18nKey: string }
> = {
    running: {
        color: 'bg-success',
        pulse: true,
        i18nKey: 'vision.status.active',
    },
    loading: {
        color: 'bg-warning',
        pulse: true,
        i18nKey: 'vision.status.loading',
    },
    ready: {
        color: 'bg-warning',
        pulse: false,
        i18nKey: 'vision.status.loading',
    },
    error: {
        color: 'bg-danger',
        pulse: false,
        i18nKey: 'vision.status.error',
    },
    paused: {
        color: 'bg-warning',
        pulse: false,
        i18nKey: 'vision.status.paused',
    },
    idle: {
        color: 'bg-muted-foreground/40',
        pulse: false,
        i18nKey: 'vision.status.inactive',
    },
};

/**
 * Small status badge indicating the vision engine state.
 * Can be placed in the app header, game wrapper, or settings panel.
 */
function GestureStatusIndicator({
    status,
    className,
}: GestureStatusIndicatorProps) {
    const { t } = useTranslation();
    const cfg = statusConfig[status];

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-2.5 py-1',
                className,
            )}
        >
            <span
                className={cn(
                    'size-2 rounded-full',
                    cfg.color,
                    cfg.pulse && 'animate-pulse',
                )}
            />
            <span className="text-[11px] font-medium text-muted-foreground">
                {t(cfg.i18nKey)}
            </span>
        </div>
    );
}

export { GestureStatusIndicator };
