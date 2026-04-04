/**
 * Traduce GestureEvent y HeadTrackPosition a eventos DOM reales
 * (KeyboardEvent, MouseEvent) sobre un EventTarget configurable.
 *
 * Uso típico:
 * ```typescript
 * const dispatcher = new ActionDispatcher(mapping, 'gesture');
 * // Conectar con useGestureEngine:
 * const onGesture = (e: GestureEvent) => dispatcher.dispatch(e.gesture);
 * const onHeadMove = (p: HeadTrackPosition) => dispatcher.handleHeadMove(p);
 * // Limpiar al desmontar:
 * dispatcher.destroy();
 * ```
 *
 * Nota 3.3: Para integrar con un iframe, llamar setTarget(iframe.contentWindow).
 * Los eventos se despacharán en el contexto del juego embebido.
 */

import { HeadDirectionType, resolveEventKey } from './action-types';
import type { GameAction, GestureActionMapping, HeadTrackingMode } from './action-types';
import type { HeadTrackPosition } from './head-tracker';
import type { GestureType } from './types';

// ---------------------------------------------------------------------------
// Constantes de configuración
// ---------------------------------------------------------------------------

/**
 * Umbral de posición [0,1] para activar triggers HEAD_*.
 *
 * Zona de reposo central: [HEAD_THRESHOLD_LOW, HEAD_THRESHOLD_HIGH].
 * Salir de esta zona activa el trigger correspondiente.
 *
 * HEAD_LEFT:  x < 0.3  (cabeza girada a la izquierda  → cursor en borde izquierdo)
 * HEAD_RIGHT: x > 0.7  (cabeza girada a la derecha     → cursor en borde derecho)
 * HEAD_UP:    y < 0.3  (cabeza inclinada hacia arriba  → cursor en borde superior)
 * HEAD_DOWN:  y > 0.7  (cabeza inclinada hacia abajo   → cursor en borde inferior)
 */
const HEAD_THRESHOLD_LOW = 0.3;
const HEAD_THRESHOLD_HIGH = 0.7;

/**
 * Duración de retención automática para gestos faciales en modo 'hold'.
 *
 * Los gestos faciales son eventos discretos con debounce de 300ms.
 * Para simular un "hold", cada evento renueva este timer, manteniendo
 * la tecla presionada mientras el gesto se sostiene. Debe ser mayor
 * que GESTURE_DEBOUNCE_MS (300ms) para evitar soltar entre disparos.
 */
const FACIAL_HOLD_EXTEND_MS = 400;

// ---------------------------------------------------------------------------
// ActionDispatcher
// ---------------------------------------------------------------------------

export class ActionDispatcher {
    private mapping: GestureActionMapping;
    private headTrackingMode: HeadTrackingMode;
    private target: EventTarget;

    /**
     * Teclas actualmente en estado 'keydown'.
     * Map<eventKey, code> — guarda el code original para el keyup correcto.
     */
    private readonly heldKeys = new Map<string, string>();

    /**
     * Timers de auto-liberación para gestos faciales con mode:'hold'.
     * Map<eventKey, timerId>
     */
    private readonly holdTimers = new Map<string, ReturnType<typeof setTimeout>>();

    /** Direcciones de cabeza virtuales actualmente activas (umbral cruzado). */
    private readonly activeHeadDirs = new Set<HeadDirectionType>();

    constructor(
        mapping: GestureActionMapping,
        headTrackingMode: HeadTrackingMode,
        target: EventTarget = document,
    ) {
        this.mapping = mapping;
        this.headTrackingMode = headTrackingMode;
        this.target = target;
    }

    // -----------------------------------------------------------------------
    // API pública
    // -----------------------------------------------------------------------

    /**
     * Despacha la acción asociada a un gesto facial detectado.
     *
     * Llamar desde useGestureEngine.onGesture:
     * ```typescript
     * onGesture: (e) => dispatcher.dispatch(e.gesture)
     * ```
     */
    dispatch(gesture: GestureType): void {
        const action = this.mapping[gesture];
        if (!action || action.type === 'none') return;
        this.executeAction(action, false);
    }

    /**
     * Procesa la posición del cursor de cabeza y genera triggers HEAD_*
     * virtuales cuando se cruzan los umbrales definidos.
     *
     * Solo actúa cuando headTrackingMode === 'gesture'.
     * En modo 'cursor', la posición la consume directamente el componente render.
     *
     * Ejes verificados empíricamente en Vision Lab (2026-04-04):
     * - x=0 → borde izquierdo, x=1 → borde derecho
     * - y=0 → borde superior,  y=1 → borde inferior
     *
     * Llamar desde useGestureEngine.onHeadMove:
     * ```typescript
     * onHeadMove: (p) => dispatcher.handleHeadMove(p)
     * ```
     */
    handleHeadMove(position: HeadTrackPosition): void {
        if (this.headTrackingMode !== 'gesture') return;

        const zones: [HeadDirectionType, boolean][] = [
            [HeadDirectionType.HeadLeft, position.x < HEAD_THRESHOLD_LOW],
            [HeadDirectionType.HeadRight, position.x > HEAD_THRESHOLD_HIGH],
            [HeadDirectionType.HeadUp, position.y < HEAD_THRESHOLD_LOW],
            [HeadDirectionType.HeadDown, position.y > HEAD_THRESHOLD_HIGH],
        ];

        for (const [dir, isActive] of zones) {
            const wasActive = this.activeHeadDirs.has(dir);

            if (isActive && !wasActive) {
                // Dirección recién activada: ejecutar la acción.
                this.activeHeadDirs.add(dir);
                const action = this.mapping[dir];
                if (action && action.type !== 'none') {
                    this.executeAction(action, true);
                }
            } else if (!isActive && wasActive) {
                // Dirección recién desactivada: liberar tecla si estaba en hold.
                this.activeHeadDirs.delete(dir);
                const action = this.mapping[dir];
                if (action?.type === 'keyboard' && action.mode === 'hold') {
                    this.releaseKey(resolveEventKey(action.key));
                }
            }
        }
    }

    /**
     * Actualiza el mapping en tiempo de ejecución.
     * Libera teclas retenidas antes de cambiar para evitar inputs bloqueados.
     */
    setMapping(mapping: GestureActionMapping): void {
        this.releaseAllHeldKeys();
        this.activeHeadDirs.clear();
        this.mapping = mapping;
    }

    /**
     * Cambia el EventTarget al que se despachan los eventos.
     *
     * Nota 3.3: Llamar con iframe.contentWindow para redirigir al juego embebido.
     */
    setTarget(target: EventTarget): void {
        this.releaseAllHeldKeys();
        this.target = target;
    }

    /** Cambia el modo de head tracking en tiempo de ejecución. */
    setHeadTrackingMode(mode: HeadTrackingMode): void {
        this.releaseAllHeldKeys();
        this.activeHeadDirs.clear();
        this.headTrackingMode = mode;
    }

    /**
     * Libera todas las teclas retenidas y cancela timers pendientes.
     * Llamar siempre en el cleanup de useEffect.
     */
    destroy(): void {
        this.releaseAllHeldKeys();
        this.activeHeadDirs.clear();
    }

    // -----------------------------------------------------------------------
    // Internos
    // -----------------------------------------------------------------------

    private executeAction(action: GameAction, isHeadDir: boolean): void {
        switch (action.type) {
            case 'keyboard':
                this.dispatchKeyboard(action.key, action.mode, isHeadDir);
                break;
            case 'mouse_click':
                this.dispatchMouseClick(action.button);
                break;
            case 'game_event':
                // Nota 3.3: Reemplazar por:
                //   this.target.postMessage({ type: 'GAME_ACTION', event: action.event }, targetOrigin)
                // cuando el target sea un iframe.contentWindow.
                this.target.dispatchEvent(
                    new CustomEvent('vout:game_event', {
                        bubbles: true,
                        detail: { event: action.event },
                    }),
                );
                break;
            case 'none':
                break;
        }
    }

    /**
     * Despacha eventos de teclado al target.
     *
     * @param code      Valor de GameAction.key (KeyboardEvent.code, ej: 'Space', 'ArrowLeft').
     * @param mode      'press' = keydown+keyup inmediatos. 'hold' = retener tecla.
     * @param isHeadDir Si es HEAD_*: el keyup lo gestiona handleHeadMove al salir del umbral.
     *                  Si es gesto facial: se usa timer de auto-liberación (FACIAL_HOLD_EXTEND_MS).
     */
    private dispatchKeyboard(code: string, mode: 'press' | 'hold', isHeadDir: boolean): void {
        const eventKey = resolveEventKey(code);

        if (mode === 'press') {
            this.target.dispatchEvent(this.makeKeyEvent('keydown', eventKey, code));
            this.target.dispatchEvent(this.makeKeyEvent('keyup', eventKey, code));
            return;
        }

        // Modo hold — keydown ahora, keyup diferido.
        if (!this.heldKeys.has(eventKey)) {
            this.heldKeys.set(eventKey, code);
            this.target.dispatchEvent(this.makeKeyEvent('keydown', eventKey, code));
        }

        if (!isHeadDir) {
            // Gesto facial: liberar automáticamente si el gesto cesa.
            // Cada disparo renueva el timer, manteniendo la tecla si el gesto se sostiene.
            const existing = this.holdTimers.get(eventKey);
            if (existing !== undefined) clearTimeout(existing);

            const timer = setTimeout(() => {
                this.releaseKey(eventKey);
                this.holdTimers.delete(eventKey);
            }, FACIAL_HOLD_EXTEND_MS);

            this.holdTimers.set(eventKey, timer);
        }
        // Para isHeadDir: el keyup se lanza en handleHeadMove al volver al rango central.
    }

    private dispatchMouseClick(button: 'left' | 'right'): void {
        const buttonIndex = button === 'left' ? 0 : 2;
        this.target.dispatchEvent(new MouseEvent('mousedown', { button: buttonIndex, bubbles: true, cancelable: true }));
        this.target.dispatchEvent(new MouseEvent('mouseup', { button: buttonIndex, bubbles: true, cancelable: true }));
        this.target.dispatchEvent(new MouseEvent('click', { button: buttonIndex, bubbles: true, cancelable: true }));
    }

    /** Libera una tecla retenida, usando el code guardado para el keyup correcto. */
    private releaseKey(eventKey: string): void {
        const code = this.heldKeys.get(eventKey);
        if (code === undefined) return;
        this.heldKeys.delete(eventKey);
        this.target.dispatchEvent(this.makeKeyEvent('keyup', eventKey, code));
    }

    /** Libera todas las teclas retenidas y cancela todos los timers de hold. */
    private releaseAllHeldKeys(): void {
        for (const [eventKey, code] of this.heldKeys) {
            this.target.dispatchEvent(this.makeKeyEvent('keyup', eventKey, code));
        }
        this.heldKeys.clear();

        for (const timer of this.holdTimers.values()) {
            clearTimeout(timer);
        }
        this.holdTimers.clear();
    }

    private makeKeyEvent(type: 'keydown' | 'keyup', key: string, code: string): KeyboardEvent {
        return new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
    }
}
