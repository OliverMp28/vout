/**
 * Estado de la cámara en la cabecera de la página de juego, visible aunque
 * el panel esté cerrado: con la cámara encendida siempre se ve que lo está y
 * se puede apagar con un clic. Quien juega con la cámara tiene además aquí
 * un "Activar cámara" rápido.
 */

import { Loader2, Video, VideoOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import type { EngineStatus } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

type CameraStatusProps = {
    engineStatus: EngineStatus;
    cameraBusy: boolean;
    /** Ofrecer "Activar cámara" con el motor parado. */
    quickActivate: boolean;
    onToggleEngine: () => void;
    onEngineIntent?: () => void;
    /** `overlay`: sobre fondo oscuro (pantalla completa). */
    tone?: 'default' | 'overlay';
};

export function CameraStatus({
    engineStatus,
    cameraBusy,
    quickActivate,
    onToggleEngine,
    onEngineIntent,
    tone = 'default',
}: CameraStatusProps) {
    const { t } = useTranslation();
    const active =
        engineStatus === 'running' ||
        engineStatus === 'loading' ||
        engineStatus === 'paused';

    if (active) {
        return (
            <div
                id="play-camera-status"
                data-camera-active="true"
                className={cn(
                    'flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 py-1 pr-1 pl-3 text-xs font-medium',
                    tone === 'overlay'
                        ? 'w-full justify-between text-white'
                        : 'text-foreground',
                )}
            >
                <span className="relative flex size-2" aria-hidden="true">
                    <span className="absolute inline-flex size-full rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                </span>
                <span className="ml-1">
                    {engineStatus === 'loading'
                        ? t('play.camera_status.loading')
                        : t('play.camera_status.active')}
                </span>
                <Button
                    type="button"
                    id="play-camera-stop"
                    size="sm"
                    variant="ghost"
                    onClick={onToggleEngine}
                    className={cn(
                        'ml-1 h-7 gap-1.5 rounded-full px-2.5 text-xs',
                        tone === 'overlay' &&
                            'text-white hover:bg-white/10 hover:text-white',
                    )}
                >
                    <VideoOff aria-hidden="true" className="size-3.5" />
                    {t('play.camera_status.stop')}
                </Button>
            </div>
        );
    }

    if (!quickActivate) {
        return null;
    }

    return (
        <Button
            type="button"
            id="play-camera-start"
            size="sm"
            onClick={onToggleEngine}
            onPointerEnter={onEngineIntent}
            onFocus={onEngineIntent}
            disabled={cameraBusy}
            aria-busy={cameraBusy}
            className="gap-2"
        >
            {cameraBusy ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
                <Video aria-hidden="true" className="size-4" />
            )}
            {cameraBusy
                ? t('play.camera.connecting')
                : t('play.camera_status.start')}
        </Button>
    );
}
