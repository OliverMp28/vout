/**
 * La cámara en miniatura sobre el juego, cuando el panel no se ve (cerrado,
 * o la hoja móvil sin abrir): quien la encendió la sigue viendo sin ocupar
 * una columna. La pinta el worker, como en el panel. A pantalla completa va
 * en la barra lateral, fuera del juego.
 */

import { Camera, X } from 'lucide-react';

import { FaceMeshView } from '@/components/vision/face-mesh-view';
import type { FaceMeshPreviewTarget } from '@/hooks/use-face-mesh-preview';
import { useTranslation } from '@/hooks/use-translation';

type CameraThumbnailProps = {
    engine: FaceMeshPreviewTarget;
    /** Apaga la vista de la cámara (la preferencia, no la cámara). */
    onHide: () => void;
    /**
     * En su sitio, en lugar de flotar en una esquina del juego (la barra
     * lateral de la pantalla completa).
     */
    inline?: boolean;
};

export function CameraThumbnail({
    engine,
    onHide,
    inline = false,
}: CameraThumbnailProps) {
    const { t } = useTranslation();

    return (
        <div
            id="play-camera-thumbnail"
            className={
                inline
                    ? 'relative w-full'
                    : 'absolute right-3 bottom-3 z-40 w-36 sm:w-44'
            }
        >
            <FaceMeshView
                engine={engine}
                mode="synced"
                mesh="full"
                className="aspect-[4/3] w-full rounded-lg border border-white/20 bg-black shadow-lg"
            >
                <Camera
                    aria-hidden="true"
                    className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-white/30"
                />
            </FaceMeshView>
            <button
                type="button"
                id="play-camera-thumbnail-hide"
                onClick={onHide}
                aria-label={t('play.thumbnail.hide')}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white transition-colors duration-200 hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                <X aria-hidden="true" className="size-3.5" />
            </button>
        </div>
    );
}
