/**
 * Hook que conecta el sistema de detección de gestos con ActionDispatcher.
 *
 * Devuelve callbacks con referencia estable entre renders — aptos para pasar
 * directamente a useGestureEngine sin provocar re-sincronizaciones innecesarias.
 *
 * Uso:
 * ```typescript
 * const dispatcher = useActionDispatcher({ mapping, headTrackingMode, enabled });
 * const engine = useGestureEngine({
 *   sensitivity,
 *   onGesture:  dispatcher.onGesture,
 *   onHeadMove: dispatcher.onHeadMove,
 * });
 * // Al desmontar el componente, el hook llama destroy() automáticamente.
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';

import { ActionDispatcher } from '@/lib/mediapipe/action-dispatcher';
import type { GestureActionMapping, HeadTrackingMode } from '@/lib/mediapipe/action-types';
import type { HeadTrackPosition } from '@/lib/mediapipe/head-tracker';
import type { GestureEvent } from '@/lib/mediapipe/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type UseActionDispatcherOptions = {
    /**
     * Mapeo de triggers (GestureType | HeadDirectionType) a GameAction.
     * Memoizar con useMemo para evitar que el effect de sincronización se
     * ejecute en cada render.
     */
    mapping: GestureActionMapping;
    /** Modo de head tracking (cursor | gesture | disabled). */
    headTrackingMode: HeadTrackingMode;
    /**
     * Si false, onGesture y onHeadMove son no-ops: los gestos detectados
     * no generan ningún evento DOM. Libera teclas retenidas al pasar a false.
     */
    enabled: boolean;
    /**
     * EventTarget al que se despachan los eventos DOM generados.
     * Por defecto: document.
     * Nota 3.3: pasar iframe.contentWindow tras el handshake READY.
     */
    target?: EventTarget;
    /**
     * Origen validado del iframe (resultado del handshake READY) usado como
     * `targetOrigin` en los `postMessage` de `game_event`. Si es undefined o
     * null, los `game_event` usan el fallback `CustomEvent` local.
     *
     * Nota 3.3: nunca usar `'*'` — sería una fuga de credenciales.
     */
    allowedOrigin?: string | null;
};

type UseActionDispatcherReturn = {
    /**
     * Callback para useGestureEngine.onGesture.
     * Referencia estable: no cambia entre renders.
     */
    onGesture: (event: GestureEvent) => void;
    /**
     * Callback para useGestureEngine.onHeadMove.
     * Referencia estable: no cambia entre renders.
     */
    onHeadMove: (position: HeadTrackPosition) => void;
    /** Actualiza el mapping sin re-crear el dispatcher ni soltar teclas (a menos que haya hold activo). */
    setMapping: (mapping: GestureActionMapping) => void;
    /** Activa o desactiva el dispatcher en tiempo de ejecución. */
    setEnabled: (enabled: boolean) => void;
    /**
     * Cambia el EventTarget en tiempo de ejecución.
     * Nota 3.3: llamar con iframe.contentWindow tras el handshake READY.
     */
    setTarget: (target: EventTarget) => void;
    /**
     * Cambia el origen permitido para los `postMessage` de `game_event`.
     * Pasar `null` revierte al fallback `CustomEvent` local.
     */
    setAllowedOrigin: (origin: string | null) => void;
    /**
     * Libera todas las teclas retenidas inmediatamente sin desactivar el dispatcher.
     * Llamar cuando el motor se pause o detenga para evitar inputs bloqueados.
     */
    releaseHeldKeys: () => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useActionDispatcher({
    mapping,
    headTrackingMode,
    enabled,
    target,
    allowedOrigin,
}: UseActionDispatcherOptions): UseActionDispatcherReturn {
    // Instancia del dispatcher — creada una vez, actualizada vía métodos.
    // No se re-crea entre renders para evitar liberar teclas retenidas o
    // reiniciar el estado de head tracking de forma involuntaria.
    const dispatcherRef = useRef(
        new ActionDispatcher(mapping, headTrackingMode, target ?? document),
    );

    // Ref para 'enabled' — los callbacks leen de aquí para mantener
    // referencia estable (no capturan el valor del closure).
    const enabledRef = useRef(enabled);

    // Sincronizar enabledRef en cada render (patrón react-hooks/refs).
    // Sin array de dependencias: se ejecuta después de cada render para que
    // los callbacks siempre lean el valor más reciente.
    useEffect(() => {
        enabledRef.current = enabled;
    });

    // Liberar teclas retenidas inmediatamente al desactivar.
    useEffect(() => {
        if (!enabled) {
            dispatcherRef.current.destroy();
        }
    }, [enabled]);

    // Sincronizar mapping cuando su referencia cambia.
    // Si el consumidor pasa un objeto literal sin useMemo, este effect se
    // ejecutará en cada render (no es un error, pero sí ineficiente).
    useEffect(() => {
        dispatcherRef.current.setMapping(mapping);
    }, [mapping]);

    // Sincronizar modo de head tracking.
    useEffect(() => {
        dispatcherRef.current.setHeadTrackingMode(headTrackingMode);
    }, [headTrackingMode]);

    // Sincronizar target (o restaurar document si pasa a undefined).
    useEffect(() => {
        dispatcherRef.current.setTarget(target ?? document);
    }, [target]);

    // Sincronizar el origen permitido para postMessage. Se ejecuta después del
    // effect de target para que el orden sea consistente: primero apuntamos al
    // iframe, luego habilitamos los envíos por postMessage con su origen.
    useEffect(() => {
        dispatcherRef.current.setAllowedOrigin(allowedOrigin ?? null);
    }, [allowedOrigin]);

    // Cleanup al desmontar: liberar teclas retenidas y cancelar timers.
    useEffect(() => {
        const dispatcher = dispatcherRef.current;
        return () => dispatcher.destroy();
    }, []);

    // -----------------------------------------------------------------------
    // Callbacks estables — sin dependencias en el array
    // -----------------------------------------------------------------------
    // Las dependencias viven en refs, no en el closure. Esto garantiza que
    // las referencias devueltas no cambien entre renders, evitando que
    // useGestureEngine re-ejecute sus efectos de sincronización.

    const onGesture = useCallback((event: GestureEvent) => {
        if (!enabledRef.current) return;
        dispatcherRef.current.dispatch(event.gesture);
    }, []);

    const onHeadMove = useCallback((position: HeadTrackPosition) => {
        if (!enabledRef.current) return;
        dispatcherRef.current.handleHeadMove(position);
    }, []);

    const setMapping = useCallback((newMapping: GestureActionMapping) => {
        dispatcherRef.current.setMapping(newMapping);
    }, []);

    const setEnabled = useCallback((newEnabled: boolean) => {
        enabledRef.current = newEnabled;
        if (!newEnabled) {
            dispatcherRef.current.destroy();
        }
    }, []);

    const setTarget = useCallback((newTarget: EventTarget) => {
        dispatcherRef.current.setTarget(newTarget);
    }, []);

    const setAllowedOrigin = useCallback((newOrigin: string | null) => {
        dispatcherRef.current.setAllowedOrigin(newOrigin);
    }, []);

    const releaseHeldKeys = useCallback(() => {
        dispatcherRef.current.destroy();
    }, []);

    return {
        onGesture,
        onHeadMove,
        setMapping,
        setEnabled,
        setTarget,
        setAllowedOrigin,
        releaseHeldKeys,
    };
}
