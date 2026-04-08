/**
 * Transformación pura de coordenadas del cursor virtual de cabeza desde el
 * espacio de pantalla al espacio interno del iframe del juego.
 *
 * Contexto:
 * - `HeadTracker.update()` devuelve `HeadTrackPosition` con `x`, `y` en [0, 1]
 *   relativos a la ventana del navegador completa (de borde a borde).
 * - El iframe del juego ocupa solo una parte del viewport (ej. ~80% en
 *   desktop, full-width en mobile). El juego espera coordenadas relativas a
 *   su propio canvas, no al viewport del padre.
 * - Vout calcula la transformación aquí y envía el resultado por
 *   `postMessage` con el mensaje `VOUT_CURSOR { x, y }`.
 *
 * Garantías:
 * - Salida siempre normalizada en [0, 1] (clamp final).
 * - Función pura: sin efectos secundarios, sin DOM, sin React. Apta para
 *   tests unitarios y para uso en Web Workers en el futuro.
 *
 * Referencia: `plan-3.2.md` §4 (fórmula original).
 */

import type { HeadTrackPosition } from '@/lib/mediapipe/head-tracker';

/**
 * Coordenada normalizada [0, 1] relativa al iframe.
 *
 * Convención:
 * - x = 0 → borde izquierdo del iframe
 * - x = 1 → borde derecho del iframe
 * - y = 0 → borde superior del iframe
 * - y = 1 → borde inferior del iframe
 *
 * Coherente con la convención de `HeadTrackPosition`.
 */
export type IframeCursorPosition = {
    x: number;
    y: number;
};

/**
 * Convierte una `HeadTrackPosition` (espacio de viewport) a una posición
 * relativa al rectángulo del iframe.
 *
 * @param position      Coordenadas en espacio de viewport [0, 1].
 * @param iframeRect    Rectángulo del iframe en coordenadas de viewport
 *                      (obtenido con `iframe.getBoundingClientRect()`).
 * @param windowWidth   Ancho del viewport en píxeles (`window.innerWidth`).
 * @param windowHeight  Alto del viewport en píxeles (`window.innerHeight`).
 *
 * @returns Coordenadas relativas al iframe, clampeadas a [0, 1]. Cuando el
 *          cursor está fuera del iframe (cabeza apuntando a otra zona del
 *          portal), las coordenadas se clampean al borde más cercano para
 *          que el juego siempre reciba un valor válido.
 */
export function transformCursorToIframe(
    position: HeadTrackPosition,
    iframeRect: DOMRect,
    windowWidth: number,
    windowHeight: number,
): IframeCursorPosition {
    // Si el iframe tiene tamaño cero (no montado, oculto o display:none),
    // devolvemos el centro como valor seguro en lugar de dividir por cero.
    if (iframeRect.width <= 0 || iframeRect.height <= 0) {
        return { x: 0.5, y: 0.5 };
    }

    // 1. Cursor en píxeles absolutos dentro del viewport.
    const screenX = position.x * windowWidth;
    const screenY = position.y * windowHeight;

    // 2. Reposicionar relativo a la esquina superior izquierda del iframe.
    const relX = (screenX - iframeRect.left) / iframeRect.width;
    const relY = (screenY - iframeRect.top) / iframeRect.height;

    // 3. Clamp a [0, 1] — el juego nunca recibe valores fuera de rango.
    return {
        x: clamp01(relX),
        y: clamp01(relY),
    };
}

function clamp01(value: number): number {
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}
