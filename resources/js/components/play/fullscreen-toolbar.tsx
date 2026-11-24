/**
 * Barra lateral de la pantalla completa, al lado del juego y nunca encima:
 * los juegos ponen sus propios botones en las esquinas (pausa, salir…) y
 * nada del portal debe taparlos. El juego se encoge un poco para dejarle
 * sitio.
 *
 * Va dentro del escenario (lo de fuera no se ve a pantalla completa, ni los
 * menús que Radix pinta en `<body>`), con botones normales, y no se oculta
 * sola: quien juega sin manos tiene que ver siempre el estado de la cámara.
 * Solo se muestra en juegos con control facial: en los demás el juego ocupa
 * toda la pantalla y se sale con Esc.
 */

import { Minimize2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { CameraStatus } from '@/components/play/camera-status';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type FullscreenToolbarProps = {
    onExit: () => void;
    /** Estado de la cámara (solo en juegos con control facial). */
    cameraStatus: ComponentProps<typeof CameraStatus>;
    /** La cámara en miniatura, si se está viendo. */
    thumbnail?: ReactNode;
};

export function FullscreenToolbar({
    onExit,
    cameraStatus,
    thumbnail,
}: FullscreenToolbarProps) {
    const { t } = useTranslation();

    return (
        <div
            id="play-fullscreen-toolbar"
            className={cn(
                'flex h-full shrink-0 flex-col gap-3 border-l border-on-media/10 bg-media p-3 text-on-media',
                'w-60',
            )}
        >
            <Button
                type="button"
                id="play-fullscreen-exit"
                size="sm"
                variant="ghost"
                onClick={onExit}
                aria-label={t('play.fullscreen.exit')}
                title={t('play.fullscreen.exit')}
                className="h-9 justify-start gap-2 rounded-lg px-3 text-on-media hover:bg-on-media/10 hover:text-on-media"
            >
                <Minimize2 aria-hidden="true" className="size-4" />
                <span>{t('play.fullscreen.exit')}</span>
            </Button>

            <CameraStatus {...cameraStatus} />

            {thumbnail && <div className="mt-auto">{thumbnail}</div>}
        </div>
    );
}
