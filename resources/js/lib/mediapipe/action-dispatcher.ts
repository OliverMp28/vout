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
import type {
    GameAction,
    GestureActionMapping,
    HeadTrackingMode,
} from './action-types';
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
 * El clasificador dispara cada ~300ms (GESTURE_DEBOUNCE_MS). Este timer
 * se renueva con cada disparo, manteniendo la tecla presionada mientras
 * el gesto se sostiene. Al dejar de detectar el gesto, expira y despacha
 * el KEYUP.
 *
 * Valor elegido como 2× GESTURE_DEBOUNCE_MS (300ms) para absorber jitter
 * en la detección (lag del worker, variaciones de frame rate). Con 100ms
 * de margen la tecla se soltaba prematuramente en hardware lento.
 */
const FACIAL_HOLD_EXTEND_MS = 600;

/**
 * Tiempo de inactividad para considerar que un gesto facial ha terminado.
 *
 * El clasificador dispara cada ~300ms mientras el gesto supera el umbral.
 * Si no llega un nuevo disparo en este margen, el gesto se considera
 * finalizado y el siguiente disparo se tratará como un nuevo inicio (onset).
 *
 * Debe ser > FACIAL_HOLD_EXTEND_MS (600ms) y > GESTURE_DEBOUNCE_MS (300ms)
 * para no expirar entre disparos válidos del mismo gesto sostenido.
 */
const GESTURE_INACTIVITY_MS = 750;

// ---------------------------------------------------------------------------
// ActionDispatcher
// ---------------------------------------------------------------------------

/**
 * Comprueba si un EventTarget es una `Window` (real o iframe `contentWindow`).
 *
 * No usamos `instanceof Window` porque el Window de un iframe pertenece al
 * realm del iframe, no al del documento padre, y `instanceof` falla a través
 * de realms. Detectar `postMessage` es la comprobación canónica usada por
 * librerías cross-frame.
 */
function isWindow(target: EventTarget): target is Window {
    return typeof (target as Partial<Window>).postMessage === 'function';
}

export class ActionDispatcher {
    private mapping: GestureActionMapping;
    private headTrackingMode: HeadTrackingMode;
    private target: EventTarget;

    /**
     * Si `true`, los `game_event` se envían como `postMessage` al target en
     * lugar de despacharse como `CustomEvent`. Se calcula automáticamente en
     * `setTarget` al detectar una `Window`.
     */
    private targetIsWindow = false;

    /**
     * `targetOrigin` para los envíos `postMessage`. Debe configurarse vía
     * `setAllowedOrigin` después del handshake READY. Mientras sea `null`,
     * los `game_event` caen en el fallback de `CustomEvent` (modo seguro).
     *
     * Nunca debe ser `'*'` en producción — sería una fuga de credenciales si
     * el iframe navegara a un origen no confiable entre frames.
     */
    private allowedOrigin: string | null = null;

    /**
     * Teclas actualmente en estado 'keydown'.
     * Map<eventKey, code> — guarda el code original para el keyup correcto.
     */
    private readonly heldKeys = new Map<string, string>();

    /**
     * Timers de auto-liberación para gestos faciales con mode:'hold'.
     * Map<eventKey, timerId>
     */
    private readonly holdTimers = new Map<
        string,
        ReturnType<typeof setTimeout>
    >();

    /** Direcciones de cabeza virtuales actualmente activas (umbral cruzado). */
    private readonly activeHeadDirs = new Set<HeadDirectionType>();

    /**
     * Timers de expiración para la detección de onset de gestos faciales.
     *
     * El clasificador de gestos es level-triggered: dispara cada ~300ms
     * mientras el gesto supera el umbral. Este mapa rastrea si un gesto
     * está "activo" (en curso) para distinguir el primer disparo (onset)
     * de los disparos de renovación (gesto sostenido).
     *
     * Funcionamiento:
     * - Primer disparo → gesto no está en el mapa → onset = true → ejecutar acción.
     * - Disparos siguientes → gesto ya está en el mapa → onset = false → ignorar (press).
     * - Si el clasificador deja de disparar, el timer expira y el gesto se borra del mapa.
     * - El siguiente disparo se trata de nuevo como onset.
     */
    private readonly gestureActiveTimers = new Map<
        GestureType,
        ReturnType<typeof setTimeout>
    >();

    constructor(
        mapping: GestureActionMapping,
        headTrackingMode: HeadTrackingMode,
        target: EventTarget = document,
    ) {
        this.mapping = mapping;
        this.headTrackingMode = headTrackingMode;
        this.target = target;
        this.targetIsWindow = isWindow(target);
    }

    // -----------------------------------------------------------------------
    // API pública
    // -----------------------------------------------------------------------

    /**
     * Despacha la acción asociada a un gesto facial detectado.
     *
     * El clasificador es level-triggered: dispara cada ~300ms mientras el
     * gesto supera el umbral. Para `mode: 'press'`, `mouse_click` y
     * `game_event`, solo se ejecuta la acción en el onset (primer disparo).
     * Para `mode: 'hold'` se deja pasar siempre: el mapa `heldKeys` ya
     * previene KEYDOWN duplicado y los disparos de renovación extienden el
     * timer de auto-liberación.
     *
     * Llamar desde useGestureEngine.onGesture:
     * ```typescript
     * onGesture: (e) => dispatcher.dispatch(e.gesture)
     * ```
     */
    dispatch(gesture: GestureType): void {
        const action = this.mapping[gesture];
        if (!action || action.type === 'none') return;

        const isOnset = this.trackGestureActive(gesture);

        // Para hold-keyboard dejamos pasar aunque no sea onset: el timer de
        // auto-liberación se renueva en dispatchKeyboard, manteniendo la tecla.
        if (!isOnset && !(action.type === 'keyboard' && action.mode === 'hold'))
            return;

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
        this.clearGestureActiveTimers();
        this.activeHeadDirs.clear();
        this.mapping = mapping;
    }

    /**
     * Cambia el EventTarget al que se despachan los eventos.
     *
     * Nota 3.3: Llamar con `iframe.contentWindow` para redirigir al juego
     * embebido. La detección de Window se hace automáticamente: los eventos
     * `keyboard` y `mouse_click` se despachan sobre `contentWindow.document`
     * (no sobre la Window) para que propaguen correctamente — `document.addEventListener`
     * en el juego los recibe; los `game_event` viajan por `postMessage`.
     * Para iframes cross-origin los keyboard events caen sobre la Window como
     * último recurso (el juego debe escuchar en `window` en ese caso).
     */
    setTarget(target: EventTarget): void {
        this.releaseAllHeldKeys();
        this.clearGestureActiveTimers();
        this.target = target;
        this.targetIsWindow = isWindow(target);
    }

    // -----------------------------------------------------------------------
    // Helpers internos
    // -----------------------------------------------------------------------

    /**
     * EventTarget real para `dispatchEvent` de teclado y ratón.
     *
     * Cuando el target es una Window (ej. `iframe.contentWindow`), los eventos
     * KeyboardEvent/MouseEvent deben despacharse sobre su `document`, NO sobre
     * la Window.
     *
     * Motivo: los eventos DOM propagan de hijo a padre (elemento → body →
     * document → window). Despachar sobre `window` significa que el evento
     * está ya en el tope de la cadena — no hay nada más arriba. Por eso
     * `document.addEventListener('keydown')` (que escucha en la fase bubble,
     * debajo de window) NO recibe eventos despachados sobre window.
     * Despachar sobre `document` sí llega a cualquier listener en document O
     * en window (porque el evento burbujea de document → window).
     *
     * Para acciones `game_event` se sigue usando `this.target` directamente
     * (postMessage pertenece al objeto Window, no al Document).
     *
     * Para iframes cross-origin, acceder a `contentWindow.document` lanzaría
     * SecurityError — en ese caso recae en `this.target` (keydown en window,
     * que el juego puede capturar si escucha sobre window en lugar de document).
     */
    private get eventTarget(): EventTarget {
        if (this.targetIsWindow) {
            try {
                return (this.target as Window).document;
            } catch {
                // Iframe cross-origin: no se puede acceder a su document.
                // El juego debe escuchar los keyboard events en window.
                return this.target;
            }
        }
        return this.target;
    }

    /**
     * Configura el `targetOrigin` para los envíos `postMessage` de game_event.
     *
     * Debe llamarse después del handshake READY con el origen validado del
     * iframe. Pasar `null` revierte al fallback de `CustomEvent` (útil al
     * desconectar). Nunca usar `'*'` — sería una fuga de credenciales si el
     * iframe navegara a un origen no confiable entre frames.
     */
    setAllowedOrigin(origin: string | null): void {
        this.allowedOrigin = origin;
    }

    /** Cambia el modo de head tracking en tiempo de ejecución. */
    setHeadTrackingMode(mode: HeadTrackingMode): void {
        this.releaseAllHeldKeys();
        this.clearGestureActiveTimers();
        this.activeHeadDirs.clear();
        this.headTrackingMode = mode;
    }

    /**
     * Libera todas las teclas retenidas y cancela timers pendientes.
     * Llamar siempre en el cleanup de useEffect.
     */
    destroy(): void {
        this.releaseAllHeldKeys();
        this.clearGestureActiveTimers();
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
                if (this.targetIsWindow && this.allowedOrigin !== null) {
                    // Ruta principal en juegos embebidos: el protocolo Vout
                    // viaja por postMessage con targetOrigin estricto.
                    (this.target as Window).postMessage(
                        { type: 'VOUT_ACTION', event: action.event },
                        this.allowedOrigin,
                    );
                } else {
                    // Fallback local: Vision Lab, tests, o iframe sin
                    // handshake completado todavía. Mantiene compatibilidad
                    // con cualquier listener `vout:game_event` ya existente.
                    this.eventTarget.dispatchEvent(
                        new CustomEvent('vout:game_event', {
                            bubbles: true,
                            detail: { event: action.event },
                        }),
                    );
                }
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
    private dispatchKeyboard(
        code: string,
        mode: 'press' | 'hold',
        isHeadDir: boolean,
    ): void {
        const eventKey = resolveEventKey(code);

        if (mode === 'press') {
            this.eventTarget.dispatchEvent(
                this.makeKeyEvent('keydown', eventKey, code),
            );
            this.eventTarget.dispatchEvent(
                this.makeKeyEvent('keyup', eventKey, code),
            );
            return;
        }

        // Modo hold — keydown ahora, keyup diferido.
        if (!this.heldKeys.has(eventKey)) {
            this.heldKeys.set(eventKey, code);
            this.eventTarget.dispatchEvent(
                this.makeKeyEvent('keydown', eventKey, code),
            );
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
        this.eventTarget.dispatchEvent(
            new MouseEvent('mousedown', {
                button: buttonIndex,
                bubbles: true,
                cancelable: true,
            }),
        );
        this.eventTarget.dispatchEvent(
            new MouseEvent('mouseup', {
                button: buttonIndex,
                bubbles: true,
                cancelable: true,
            }),
        );
        this.eventTarget.dispatchEvent(
            new MouseEvent('click', {
                button: buttonIndex,
                bubbles: true,
                cancelable: true,
            }),
        );
    }

    /** Libera una tecla retenida, usando el code guardado para el keyup correcto. */
    private releaseKey(eventKey: string): void {
        const code = this.heldKeys.get(eventKey);
        if (code === undefined) return;
        this.heldKeys.delete(eventKey);
        this.eventTarget.dispatchEvent(
            this.makeKeyEvent('keyup', eventKey, code),
        );
    }

    /** Libera todas las teclas retenidas y cancela todos los timers de hold. */
    private releaseAllHeldKeys(): void {
        for (const [eventKey, code] of this.heldKeys) {
            this.eventTarget.dispatchEvent(
                this.makeKeyEvent('keyup', eventKey, code),
            );
        }
        this.heldKeys.clear();

        for (const timer of this.holdTimers.values()) {
            clearTimeout(timer);
        }
        this.holdTimers.clear();
    }

    private makeKeyEvent(
        type: 'keydown' | 'keyup',
        key: string,
        code: string,
    ): KeyboardEvent {
        return new KeyboardEvent(type, {
            key,
            code,
            bubbles: true,
            cancelable: true,
        });
    }

    /**
     * Registra que un gesto facial acaba de dispararse y determina si es un
     * onset (primer disparo) o una renovación (gesto sostenido).
     *
     * @returns `true` si es el inicio del gesto, `false` si ya estaba activo.
     */
    private trackGestureActive(gesture: GestureType): boolean {
        const wasActive = this.gestureActiveTimers.has(gesture);

        const existing = this.gestureActiveTimers.get(gesture);
        if (existing !== undefined) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.gestureActiveTimers.delete(gesture);
        }, GESTURE_INACTIVITY_MS);

        this.gestureActiveTimers.set(gesture, timer);

        return !wasActive;
    }

    /** Cancela todos los timers de seguimiento de onset de gestos faciales. */
    private clearGestureActiveTimers(): void {
        for (const timer of this.gestureActiveTimers.values()) {
            clearTimeout(timer);
        }
        this.gestureActiveTimers.clear();
    }
}
