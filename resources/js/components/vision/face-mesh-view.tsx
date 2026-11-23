import { useRef } from 'react';
import type { ReactNode } from 'react';

import { useFaceMeshPreview } from '@/hooks/use-face-mesh-preview';
import type { FaceMeshPreviewTarget } from '@/hooks/use-face-mesh-preview';
import type { MeshLevel, PreviewMode } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

type FaceMeshViewProps = {
    /** El motor (de `useGestureEngine`). */
    engine: FaceMeshPreviewTarget;
    /**
     * `overlay`: lienzo transparente para poner encima de un `<video>`
     * visible. `synced`: el worker pinta también la imagen.
     */
    mode: PreviewMode;
    mesh: MeshLevel;
    /** Tamaño y posición (p. ej. `absolute inset-0` sobre el vídeo). */
    className?: string;
    /** Lo que se ve debajo hasta que llega el primer fotograma. */
    children?: ReactNode;
};

/**
 * Vista de la cámara con la malla facial. La dibuja el worker del motor en
 * un lienzo cedido: el hilo principal (el del juego) no hace nada por
 * fotograma. En espejo, como un espejo de verdad. Ver `useFaceMeshPreview`.
 */
export function FaceMeshView({
    engine,
    mode,
    mesh,
    className,
    children,
}: FaceMeshViewProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useFaceMeshPreview(containerRef, engine, { mode, mesh });

    return (
        <div
            aria-hidden="true"
            data-face-mesh={mode}
            className={cn(
                'pointer-events-none relative overflow-hidden',
                className,
            )}
        >
            {children}
            {/* Solo para el lienzo (lo pone y lo quita PreviewSurface). */}
            <div ref={containerRef} className="absolute inset-0 scale-x-[-1]" />
        </div>
    );
}
