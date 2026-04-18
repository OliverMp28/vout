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
 * `useImperativeHandle` para que el orquestador actualice la posición sin
 * pasar por estado React, evitando reconciliaciones innecesarias en el árbol
 * padre.
 *
 * **Estrategia de render (Sesión 3.4 §2.1):**
 *
 * - Posicionamiento mediante `transform: translate3d(px, px, 0)` — activa
 *   el compositor GPU y evita layout/paint en cada frame. Antes usábamos
 *   `left/top` en %, lo que forzaba layout y, junto a una `transition` CSS
 *   de 75ms, era el principal responsable del lag visual percibido.
 * - Las dimensiones del contenedor se cachean en una ref alimentada por
 *   `ResizeObserver` para no leer `clientWidth/clientHeight` en cada
 *   `setPosition()` (esa lectura puede forzar layout síncrono).
 * - Coordenadas de entrada en [0, 1] relativas al contenedor padre
 *   (position:relative).
 * - `pointer-events-none` para no interceptar eventos del iframe.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type CursorOverlayHandle = {
    /** Actualiza la posición y visibilidad del cursor sin re-render React. */
    setPosition: (x: number, y: number, visible: boolean) => void;
};

export const CursorOverlay = forwardRef<CursorOverlayHandle>(
    function CursorOverlay(_, ref) {
        const containerRef = useRef<HTMLDivElement | null>(null);
        const dotRef = useRef<HTMLDivElement | null>(null);
        const sizeRef = useRef({ width: 0, height: 0 });

        // Cachear el tamaño del contenedor — evita layout síncrono en setPosition.
        useEffect(() => {
            const container = containerRef.current;
            if (!container) return;

            const update = () => {
                sizeRef.current = {
                    width: container.clientWidth,
                    height: container.clientHeight,
                };
            };

            update();
            const ro = new ResizeObserver(update);
            ro.observe(container);

            return () => ro.disconnect();
        }, []);

        useImperativeHandle(ref, () => ({
            setPosition(x: number, y: number, visible: boolean) {
                const el = dotRef.current;
                if (!el) return;

                const { width, height } = sizeRef.current;
                // Antes de que ResizeObserver dispare la primera medida el tamaño
                // es 0 — evitar pintar en (0,0).
                if (width === 0 || height === 0) {
                    el.style.opacity = '0';
                    return;
                }

                const px = x * width;
                const py = y * height;
                // translate3d activa el compositor GPU. No fuerza layout ni paint —
                // solo compositing — y se mueve a velocidad de pantalla.
                el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
                el.style.opacity = visible ? '1' : '0';
            },
        }));

        return (
            <div
                ref={containerRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl"
            >
                {/* Anchor de 0×0 en el origen — los hijos ya se centran sobre el
                punto con sus propias `-translate-x-1/2 -translate-y-1/2`. La
                posición real la inyecta `setPosition()` vía transform. */}
                <div
                    ref={dotRef}
                    className="absolute top-0 left-0 will-change-transform"
                    style={{
                        transform: 'translate3d(-9999px, -9999px, 0)',
                        opacity: 0,
                    }}
                >
                    {/* Anillo exterior fino — identifica el cursor del portal */}
                    <div
                        className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
                        style={{
                            filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))',
                        }}
                    />
                    {/* Línea horizontal del crosshair */}
                    <div
                        className="absolute h-px w-4 -translate-x-1/2 -translate-y-px bg-white/90"
                        style={{
                            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))',
                        }}
                    />
                    {/* Línea vertical del crosshair */}
                    <div
                        className="absolute h-4 w-px -translate-x-px -translate-y-1/2 bg-white/90"
                        style={{
                            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))',
                        }}
                    />
                    {/* Punto central para precisión */}
                    <div className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95" />
                </div>
            </div>
        );
    },
);
