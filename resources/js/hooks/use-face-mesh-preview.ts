/**
 * Engancha un contenedor de la página a la vista de la cámara con la malla
 * que dibuja el worker (`lib/mediapipe/preview-renderer.ts`).
 *
 * Solo mientras el contenedor se ve (`IntersectionObserver`): oculto (fuera
 * de pantalla, en un panel con `display: none`, en la otra copia del panel de
 * juego) no se cede ningún lienzo y el worker no dibuja nada.
 *
 * Los colores salen de los tokens `--face-mesh` y `--face-mesh-contour` de
 * `app.css`: el worker no ve las variables CSS de la página.
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { UseGestureEngineReturn } from '@/hooks/use-gesture-engine';
import {
    PreviewSurface,
    supportsPreviewSurface,
} from '@/lib/mediapipe/preview-surface';
import type {
    MeshLevel,
    PreviewMode,
    PreviewOptions,
} from '@/lib/mediapipe/types';

export type FaceMeshPreviewTarget = Pick<
    UseGestureEngineReturn,
    'attachPreview' | 'updatePreview'
>;

type FaceMeshPreviewSettings = {
    mode: PreviewMode;
    mesh: MeshLevel;
};

function resolveOptions(
    container: HTMLElement,
    { mode, mesh }: FaceMeshPreviewSettings,
): PreviewOptions {
    const style = getComputedStyle(container);

    return {
        mode,
        mesh,
        colors: {
            mesh: style.getPropertyValue('--face-mesh').trim(),
            contour: style.getPropertyValue('--face-mesh-contour').trim(),
        },
    };
}

export function useFaceMeshPreview(
    containerRef: RefObject<HTMLElement | null>,
    engine: FaceMeshPreviewTarget,
    settings: FaceMeshPreviewSettings,
): void {
    const { attachPreview, updatePreview } = engine;
    const { mode, mesh } = settings;
    const settingsRef = useRef(settings);

    useEffect(() => {
        settingsRef.current = { mode, mesh };
    });

    useEffect(() => {
        const container = containerRef.current;

        if (
            container === null ||
            !supportsPreviewSurface() ||
            typeof IntersectionObserver === 'undefined'
        ) {
            return;
        }

        let surface: PreviewSurface | null = null;
        let detach: (() => void) | null = null;

        const show = () => {
            if (surface !== null) {
                return;
            }

            surface = new PreviewSurface(container);
            detach = attachPreview(
                surface,
                resolveOptions(container, settingsRef.current),
            );
        };

        const hide = () => {
            detach?.();
            detach = null;
            surface?.dispose();
            surface = null;
        };

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                show();
            } else {
                hide();
            }
        });

        observer.observe(container);

        return () => {
            observer.disconnect();
            hide();
        };
    }, [containerRef, attachPreview]);

    useEffect(() => {
        const container = containerRef.current;

        if (container !== null) {
            updatePreview(resolveOptions(container, { mode, mesh }));
        }
    }, [containerRef, updatePreview, mode, mesh]);
}
