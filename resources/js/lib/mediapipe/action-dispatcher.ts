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
 *
 * Juegos de otro origen: el navegador no permite a la página padre tocar el
 * documento de un iframe cross-origin ni despachar eventos en su ventana, así
 * que las acciones `keyboard` y `mouse_click` se descartan. Solo `game_event`
 * (postMessage `VOUT_ACTION`) llega al juego — ver `PRESET_RUNNER`.
 *
 * Eventos de juego sostenidos: cada `game_event` avisa de su inicio
 * (`VOUT_ACTION`) y de su fin (`VOUT_ACTION_END`), ambos con `at` (ms Unix).
 * Un juego que solo necesita toques ignora el fin; uno con mecánicas de
 * "mantener" (planear, propulsor) usa los dos. El fin de una dirección de
 * cabeza es inmediato; el de un gesto facial se deduce por inactividad
 * (`GESTURE_INACTIVITY_MS`), así que llega con ese retraso.
 */

import { HeadDirectionType, resolveEventKey } from './action-types';
import type {
    ActionTrigger,
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

/**
 * Antigüedad máxima creíble de un fotograma al despacharse. Por encima de
 * esto (pestaña congelada, reloj inconsistente) se fecha con el instante
 * del envío en lugar de retroceder el reloj una cantidad absurda.
 */
const MAX_FRAME_AGE_MS = 2000;

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

/**
 * Convierte la marca de tiempo de un fotograma de cámara a milisegundos Unix.
 *
 * El motor de gestos fecha los fotogramas con `performance.now()`. Aquí se
 * resta la antigüedad del fotograma al reloj de pared, en lugar de sumarle
 * `performance.timeOrigin`: así el resultado no se desvía si el reloj
 * monotónico se detuvo con el equipo suspendido. Sin fotograma conocido se
 * devuelve el instante actual.
 */
function frameTimeToEpoch(frameTimestamp: number | undefined): number {
    const now = Date.now();
    if (frameTimestamp === undefined) return now;

    const age = performance.now() - frameTimestamp;

    return age >= 0 && age <= MAX_FRAME_AGE_MS ? Math.round(now - age) : now;
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

    /**
     * Evento de juego que cada trigger tiene en curso. Permite avisar del
     * fin (`VOUT_ACTION_END`) con el mismo nombre con el que empezó aunque el
     * mapping cambie entretanto, y saber si otro trigger mapeado al mismo
     * evento lo sigue manteniendo activo.
     */
    private readonly activeGameEvents = new Map<ActionTrigger, string>();

    /**
     * Último instante (ms Unix) en que se vio activo cada gesto facial con
     * un evento de juego en curso. Cuando el gesto termina por inactividad,
     * es la mejor estimación de cuándo dejó de hacerse realmente.
     */
    private readonly gameEventLastSeenAt = new Map<ActionTrigger, number>();

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
     * onGesture: (e) => dispatcher.dispatch(e.gesture, e.timestamp)
     * ```
     *
     * @param frameTimestamp Marca del fotograma que disparó el gesto
     *                       (`GestureEvent.timestamp`, en la línea de tiempo
     *                       de `performance.now()`). Fecha los `game_event`.
     */
    dispatch(gesture: GestureType, frameTimestamp?: number): void {
        const action = this.mapping[gesture];
        if (!action || action.type === 'none') return;

        const at = frameTimeToEpoch(frameTimestamp);
        const isOnset = this.trackGestureActive(gesture);

        // Cada disparo de un evento de juego en curso, sea inicio o
        // renovación, actualiza el último instante en que se vio el gesto.
        if (action.type === 'game_event' && !isOnset) {
            this.gameEventLastSeenAt.set(gesture, at);
        }

        // Para hold-keyboard dejamos pasar aunque no sea onset: el timer de
        // auto-liberación se renueva en dispatchKeyboard, manteniendo la tecla.
        if (!isOnset && !(action.type === 'keyboard' && action.mode === 'hold'))
            return;

        this.executeAction(action, gesture, false, at);
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
     * onHeadMove: (p, frameTimestamp) => dispatcher.handleHeadMove(p, frameTimestamp)
     * ```
     *
     * @param frameTimestamp Marca del fotograma del que sale la posición (en
     *                       la línea de tiempo de `performance.now()`). Fecha
     *                       el inicio y el fin de los `game_event`.
     */
    handleHeadMove(position: HeadTrackPosition, frameTimestamp?: number): void {
        if (this.headTrackingMode !== 'gesture') return;

        const at = frameTimeToEpoch(frameTimestamp);

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
                    this.executeAction(action, dir, true, at);
                }
            } else if (!isActive && wasActive) {
                // Dirección recién desactivada: liberar tecla si estaba en
                // hold y cerrar el evento de juego que tuviera en curso.
                this.activeHeadDirs.delete(dir);
                const action = this.mapping[dir];
                if (action?.type === 'keyboard' && action.mode === 'hold') {
                    this.releaseKey(resolveEventKey(action.key));
                }
                this.endGameEvent(dir, at);
            }
        }
    }

    /**
     * Actualiza el mapping en tiempo de ejecución.
     * Libera teclas retenidas antes de cambiar para evitar inputs bloqueados.
     */
    setMapping(mapping: GestureActionMapping): void {
        this.endAllGameEvents();
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
     * Para iframes cross-origin los eventos de teclado y ratón no se pueden
     * entregar (ver `eventTarget`); solo `game_event` alcanza al juego.
     */
    setTarget(target: EventTarget): void {
        this.endAllGameEvents();
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
     * Para iframes cross-origin devuelve `null`: acceder a
     * `contentWindow.document` lanza SecurityError, y `dispatchEvent` tampoco
     * es accesible en una Window de otro origen (la same-origin policy solo
     * expone `postMessage`, `location`, `close`, `focus` y poco más). No hay
     * forma de entregar un KeyboardEvent/MouseEvent a ese juego.
     */
    private get eventTarget(): EventTarget | null {
        if (this.targetIsWindow) {
            try {
                return (this.target as Window).document;
            } catch {
                return null;
            }
        }
        return this.target;
    }

    /**
     * Despacha un evento DOM sobre el target actual. No-op si el target es
     * un iframe de otro origen (ver `eventTarget`).
     */
    private dispatchDom(event: Event): void {
        this.eventTarget?.dispatchEvent(event);
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
        this.endAllGameEvents();
        this.releaseAllHeldKeys();
        this.clearGestureActiveTimers();
        this.activeHeadDirs.clear();
        this.headTrackingMode = mode;
    }

    /**
     * Libera todas las teclas retenidas, cierra los eventos de juego en curso
     * y cancela timers pendientes. Llamar siempre en el cleanup de useEffect.
     */
    destroy(): void {
        this.endAllGameEvents();
        this.releaseAllHeldKeys();
        this.clearGestureActiveTimers();
        this.activeHeadDirs.clear();
    }

    // -----------------------------------------------------------------------
    // Internos
    // -----------------------------------------------------------------------

    private executeAction(
        action: GameAction,
        trigger: ActionTrigger,
        isHeadDir: boolean,
        at: number,
    ): void {
        switch (action.type) {
            case 'keyboard':
                this.dispatchKeyboard(action.key, action.mode, isHeadDir);
                break;
            case 'mouse_click':
                this.dispatchMouseClick(action.button);
                break;
            case 'game_event':
                this.startGameEvent(trigger, action.event, at);
                break;
            case 'none':
                break;
        }
    }

    /**
     * Avisa al juego de que empieza un evento y lo deja registrado como en
     * curso para ese trigger, hasta que `endGameEvent` lo cierre.
     */
    private startGameEvent(
        trigger: ActionTrigger,
        event: string,
        at: number,
    ): void {
        this.activeGameEvents.set(trigger, event);
        this.gameEventLastSeenAt.set(trigger, at);
        this.emitGameEvent('VOUT_ACTION', event, at);
    }

    /**
     * Cierra el evento de juego que el trigger tuviera en curso. Solo avisa
     * al juego si ningún otro trigger mapeado al mismo evento lo mantiene.
     *
     * @param at Instante del fin (ms Unix). Si se omite se usa el último en
     *           que se vio activo el trigger (fin de gesto por inactividad).
     */
    private endGameEvent(trigger: ActionTrigger, at?: number): void {
        const event = this.activeGameEvents.get(trigger);
        if (event === undefined) return;

        const endedAt =
            at ?? this.gameEventLastSeenAt.get(trigger) ?? Date.now();

        this.activeGameEvents.delete(trigger);
        this.gameEventLastSeenAt.delete(trigger);

        for (const stillActive of this.activeGameEvents.values()) {
            if (stillActive === event) return;
        }

        this.emitGameEvent('VOUT_ACTION_END', event, endedAt);
    }

    /**
     * Cierra todos los eventos de juego en curso. Se llama antes de cambiar
     * de mapping, de target o de modo y al destruir, para que el juego no
     * se quede con una acción "mantenida" que ya nadie va a soltar.
     */
    private endAllGameEvents(): void {
        const at = Date.now();
        const events = new Set(this.activeGameEvents.values());

        this.activeGameEvents.clear();
        this.gameEventLastSeenAt.clear();

        for (const event of events) {
            this.emitGameEvent('VOUT_ACTION_END', event, at);
        }
    }

    /**
     * Entrega al juego el inicio o el fin de un evento.
     *
     * Con un iframe conectado viaja por postMessage con `targetOrigin`
     * estricto. Sin iframe (Vision Lab, tests, handshake aún sin completar)
     * cae a un `CustomEvent` local: `vout:game_event` / `vout:game_event_end`.
     */
    private emitGameEvent(
        type: 'VOUT_ACTION' | 'VOUT_ACTION_END',
        event: string,
        at: number,
    ): void {
        if (this.targetIsWindow && this.allowedOrigin !== null) {
            (this.target as Window).postMessage(
                { type, event, at },
                this.allowedOrigin,
            );

            return;
        }

        this.dispatchDom(
            new CustomEvent(
                type === 'VOUT_ACTION'
                    ? 'vout:game_event'
                    : 'vout:game_event_end',
                { bubbles: true, detail: { event, at } },
            ),
        );
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
            this.dispatchDom(this.makeKeyEvent('keydown', eventKey, code));
            this.dispatchDom(this.makeKeyEvent('keyup', eventKey, code));
            return;
        }

        // Modo hold — keydown ahora, keyup diferido.
        if (!this.heldKeys.has(eventKey)) {
            this.heldKeys.set(eventKey, code);
            this.dispatchDom(this.makeKeyEvent('keydown', eventKey, code));
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
        this.dispatchDom(
            new MouseEvent('mousedown', {
                button: buttonIndex,
                bubbles: true,
                cancelable: true,
            }),
        );
        this.dispatchDom(
            new MouseEvent('mouseup', {
                button: buttonIndex,
                bubbles: true,
                cancelable: true,
            }),
        );
        this.dispatchDom(
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
        this.dispatchDom(this.makeKeyEvent('keyup', eventKey, code));
    }

    /** Libera todas las teclas retenidas y cancela todos los timers de hold. */
    private releaseAllHeldKeys(): void {
        for (const [eventKey, code] of this.heldKeys) {
            this.dispatchDom(this.makeKeyEvent('keyup', eventKey, code));
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
            // El gesto dejó de verse: si mantenía un evento de juego, termina.
            this.endGameEvent(gesture);
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
