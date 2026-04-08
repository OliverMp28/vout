/**
 * Cursor de head-tracking visible sobre el iframe cuando el modo activo
 * es `cursor`. Es puramente decorativo para el usuario del portal — el
 * cursor real que procesa el juego llega por postMessage (VOUT_CURSOR).
 *
 * Diseño: retícula (crosshair) de dos líneas ortogonales + anillo exterior
 * fino. Sin relleno sólido para no confundirse con cursores propios del
 * juego (que suelen ser puntos sólidos).
 *
 * **API imperativa:** el componente expone `setPosition(x, y, visible)` vía
 * `useImperativeHandle` para que el orquestador actualice la posición a
 * ~30fps sin pasar por estado React, evitando reconciliaciones innecesarias
 * en el árbol padre.
 *
 * - Coordenadas en [0, 1] relativas al contenedor padre (position:relative).
 * - `pointer-events-none` para no interceptar eventos del iframe.
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';

export type CursorOverlayHandle = {
    /** Actualiza la posición y visibilidad del cursor sin re-render React. */
    setPosition: (x: number, y: number, visible: boolean) => void;
};

export const CursorOverlay = forwardRef<CursorOverlayHandle>(function CursorOverlay(_, ref) {
    const dotRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => ({
        setPosition(x: number, y: number, visible: boolean) {
            const el = dotRef.current;
            if (!el) return;
            el.style.left = `${x * 100}%`;
            el.style.top = `${y * 100}%`;
            el.style.opacity = visible ? '1' : '0';
        },
    }));

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl"
        >
            {/* Posición inicial fuera de pantalla — se actualiza imperativamente */}
            <div
                ref={dotRef}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top,opacity] duration-75"
                style={{ left: '-100%', top: '-100%', opacity: 0 }}
            >
                {/* Anillo exterior fino — identifica el cursor del portal */}
                <div
                    className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}
                />
                {/* Línea horizontal del crosshair */}
                <div
                    className="absolute h-px w-4 -translate-x-1/2 -translate-y-px bg-white/90"
                    style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }}
                />
                {/* Línea vertical del crosshair */}
                <div
                    className="absolute h-4 w-px -translate-x-px -translate-y-1/2 bg-white/90"
                    style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }}
                />
                {/* Punto central para precisión */}
                <div className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95" />
            </div>
        </div>
    );
});
