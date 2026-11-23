/**
 * Barra de herramientas de la página de juego (en la cabecera).
 *
 * - Estado de la cámara ("Cámara activa · Apagar"), visible aunque el panel
 *   esté cerrado, y el "Activar cámara" rápido de quien juega con ella.
 * - "Control facial": abre o cierra el panel (columna en escritorio, hoja
 *   en móvil). Solo en juegos que reciben los controles de Vout.
 * - En un juego que no los recibe, a quien usa la cámara se le dice por qué
 *   no hay control facial.
 */

import { ScanFace } from 'lucide-react';
import type { ComponentProps } from 'react';

import { CameraStatus } from '@/components/play/camera-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import type { PlayMode } from '@/lib/play/play-mode';
import { cn } from '@/lib/utils';

type PlayToolbarProps = {
    mode: PlayMode;
    /** El panel se ve ahora mismo. */
    panelOpen: boolean;
    /** Id del panel que abre el botón (`aria-controls`). */
    panelId: string;
    onTogglePanel: () => void;
    cameraStatus: Omit<ComponentProps<typeof CameraStatus>, 'quickActivate'>;
};

export function PlayToolbar({
    mode,
    panelOpen,
    panelId,
    onTogglePanel,
    cameraStatus,
}: PlayToolbarProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap items-center gap-2">
            {mode.showUnsupportedNotice && (
                <Badge
                    id="play-facial-control-unsupported"
                    variant="outline"
                    title={t('play.toolbar.unsupported_hint')}
                    className="gap-1.5 py-1 text-muted-foreground"
                >
                    <ScanFace aria-hidden="true" />
                    {t('play.toolbar.unsupported')}
                    <span className="sr-only">
                        {t('play.toolbar.unsupported_hint')}
                    </span>
                </Badge>
            )}

            {mode.cameraAvailable && (
                <>
                    <CameraStatus
                        {...cameraStatus}
                        quickActivate={mode.quickActivate}
                    />

                    <Button
                        type="button"
                        id="play-panel-trigger"
                        variant={panelOpen ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={onTogglePanel}
                        aria-expanded={panelOpen}
                        aria-controls={panelId}
                        className={cn(
                            'gap-2 transition-all duration-200',
                            panelOpen && 'shadow-inner',
                        )}
                    >
                        <ScanFace aria-hidden="true" className="size-4" />
                        <span>{t('play.toolbar.facial_control')}</span>
                        <span className="sr-only">
                            {panelOpen
                                ? t('play.panel.close_panel')
                                : t('play.panel.open_panel')}
                        </span>
                    </Button>
                </>
            )}
        </div>
    );
}
