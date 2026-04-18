/**
 * Orquestador de estado para la página de juego embebido.
 *
 * Extrae toda la lógica de `play/game.tsx` — estado, hooks, callbacks y
 * effects — dejando el componente como render puro.
 *
 * Responsabilidades:
 * - Inicializar `useIframeHandshake`, `useActionDispatcher`, `useGestureEngine`
 *   y `useCamera` con el cableado correcto entre ellos.
 * - Exponer handlers estables para los controles de UI.
 * - Gestionar el ciclo de vida completo: liberar teclas en blur/visibilitychange,
 *   detener motor y cámara al desmontar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useActionDispatcher } from '@/hooks/use-action-dispatcher';
import { useCamera } from '@/hooks/use-camera';
import { useGestureEngine } from '@/hooks/use-gesture-engine';
import { useIframeHandshake } from '@/hooks/use-iframe-handshake';
import { transformCursorToIframe } from '@/lib/iframe/cursor-forwarder';
import { ALL_PRESETS, PRESET_PLATFORMER } from '@/lib/mediapipe/action-presets';
import type {
    GestureActionMapping,
    HeadTrackingMode,
} from '@/lib/mediapipe/action-types';
import type { HeadTrackPosition } from '@/lib/mediapipe/head-tracker';
import type {
    GestureConfigData,
    GestureEvent,
    GestureType,
} from '@/lib/mediapipe/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type GameInfo = {
    name: string;
    slug: string;
    embed_url: string;
    effective_origins: string[];
};

type UserInfo = {
    vout_id: string;
    name: string;
};

export type UsePlayOrchestratorOptions = {
    game: GameInfo;
    activeGestureConfig: GestureConfigData | null;
    accessToken: string | null;
    user: UserInfo;
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    /** Imperativa: actualiza la posición del cursor sin pasar por estado React. */
    onCursorMove?: (x: number, y: number, visible: boolean) => void;
};

export type UsePlayOrchestratorReturn = {
    // ── Estado expuesto al render ──────────────────────────────────────────
    sensitivity: number;
    headTrackingMode: HeadTrackingMode;
    dispatchEnabled: boolean;
    lastGesture: GestureType | null;
    hasGestureConfig: boolean;
    presetSuggestion: string | null;
    errorMessage: string | null;

    // ── Subsistemas ────────────────────────────────────────────────────────
    engine: ReturnType<typeof useGestureEngine>;
    handshake: ReturnType<typeof useIframeHandshake>;

    // ── Handlers de UI ────────────────────────────────────────────────────
    handleToggleEngine: () => void;
    handleRetryGame: () => void;
    /** Recentra el cursor al centro del iframe (no del viewport). */
    recenterCursor: () => void;
    handleAcceptPreset: (presetKey: string) => void;
    setDispatchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    setSensitivity: React.Dispatch<React.SetStateAction<number>>;
    dismissPresetSuggestion: () => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlayOrchestrator({
    game,
    activeGestureConfig,
    accessToken,
    user,
    iframeRef,
    videoRef,
    onCursorMove,
}: UsePlayOrchestratorOptions): UsePlayOrchestratorReturn {
    // ── Valores base desde la config del usuario ─────────────────────────
    const baseSensitivity = activeGestureConfig?.sensitivity ?? 5;
    const baseMapping =
        activeGestureConfig?.gesture_mapping ?? PRESET_PLATFORMER.mapping;
    const baseHeadMode = activeGestureConfig?.head_tracking_mode ?? 'disabled';

    // ── Estado de UI ──────────────────────────────────────────────────────
    const [sensitivity, setSensitivity] = useState(baseSensitivity);
    const [activeMapping, setActiveMapping] =
        useState<GestureActionMapping>(baseMapping);
    const [headTrackingMode, setHeadTrackingMode] =
        useState<HeadTrackingMode>(baseHeadMode);
    const [dispatchEnabled, setDispatchEnabled] = useState(false);
    const [lastGesture, setLastGesture] = useState<GestureType | null>(null);
    const [presetSuggestion, setPresetSuggestion] = useState<string | null>(
        null,
    );

    const hasGestureConfig = activeGestureConfig !== null;

    // ── Handshake con el iframe ────────────────────────────────────────────
    const handleReady = useCallback((suggestedPreset?: string) => {
        if (suggestedPreset) setPresetSuggestion(suggestedPreset);
    }, []);

    const handshake = useIframeHandshake({
        iframeRef,
        allowedOrigins: game.effective_origins,
        accessToken,
        voutId: user.vout_id,
        username: user.name,
        onReady: handleReady,
    });

    // ── Dispatcher ────────────────────────────────────────────────────────
    // El target no se pasa como prop (requeriría leer iframeRef.current durante
    // render). Se conecta imperativamente en un useEffect más abajo, una vez
    // que handshake.status cambia a 'authenticated'.
    //
    // enabled se deriva en render para evitar un useEffect extra que llame
    // a setDispatchEnabled(false) cuando el handshake falla.
    const effectiveDispatchEnabled =
        dispatchEnabled && handshake.status !== 'error';

    const dispatcher = useActionDispatcher({
        mapping: activeMapping,
        headTrackingMode,
        enabled: effectiveDispatchEnabled,
        allowedOrigin: handshake.connectedOrigin,
    });

    // ── Callbacks del motor ───────────────────────────────────────────────
    const dispatcherOnGesture = dispatcher.onGesture;
    const handleGesture = useCallback(
        (event: GestureEvent) => {
            setLastGesture(event.gesture);
            dispatcherOnGesture(event);
        },
        [dispatcherOnGesture],
    );

    // Ref para onCursorMove — evita que handleHeadMove cambie de referencia
    // cuando el consumidor pasa una función nueva en cada render.
    const onCursorMoveRef = useRef(onCursorMove);
    useEffect(() => {
        onCursorMoveRef.current = onCursorMove;
    });

    // Sesión 3.4 §2.3 — cachear el rect del iframe.
    //
    // `getBoundingClientRect()` puede forzar layout síncrono cada vez que algo
    // cambia en el DOM. Llamarlo a 60fps en `handleHeadMove` añadía ms ocultos
    // a la latencia del cursor. Lo cacheamos en una ref alimentada por
    // ResizeObserver + listeners de scroll/resize, así la ruta caliente del
    // cursor solo lee la ref (sin layout síncrono).
    const iframeRectRef = useRef<DOMRect | null>(null);
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const updateRect = () => {
            iframeRectRef.current = iframe.getBoundingClientRect();
        };

        updateRect();
        const ro = new ResizeObserver(updateRect);
        ro.observe(iframe);
        window.addEventListener('scroll', updateRect, { passive: true });
        window.addEventListener('resize', updateRect);

        return () => {
            ro.disconnect();
            window.removeEventListener('scroll', updateRect);
            window.removeEventListener('resize', updateRect);
        };
    }, [iframeRef]);

    const dispatcherOnHeadMove = dispatcher.onHeadMove;
    const handshakeSendCursor = handshake.sendCursor;
    const handleHeadMove = useCallback(
        (position: HeadTrackPosition) => {
            dispatcherOnHeadMove(position);

            if (headTrackingMode !== 'cursor') {
                onCursorMoveRef.current?.(0, 0, false);
                return;
            }

            // Lectura barata — el rect ya está cacheado por el effect anterior.
            const rect = iframeRectRef.current;
            if (!rect) return;

            const transformed = transformCursorToIframe(
                position,
                rect,
                window.innerWidth,
                window.innerHeight,
            );

            // Actualización imperativa — no pasa por setState, evita reconciliación
            // React a 60fps solo por mover el cursor.
            onCursorMoveRef.current?.(transformed.x, transformed.y, true);
            handshakeSendCursor(transformed.x, transformed.y);
        },
        // headTrackingMode se incluye como dep porque se lee dentro del callback.
        [dispatcherOnHeadMove, handshakeSendCursor, headTrackingMode],
    );

    // ── Motor y cámara ────────────────────────────────────────────────────
    const engine = useGestureEngine({
        sensitivity,
        videoRef,
        onGesture: handleGesture,
        onHeadMove: handleHeadMove,
        enableBlendshapes: false,
    });

    const camera = useCamera({ videoRef });

    // Refs para cleanup en unmount sin re-runs.
    const engineRef = useRef(engine);
    const cameraRef = useRef(camera);
    useEffect(() => {
        engineRef.current = engine;
        cameraRef.current = camera;
    });

    // ── Handlers de UI ────────────────────────────────────────────────────
    const handleActivateEngine = useCallback(async () => {
        if (engine.status === 'running' || engine.status === 'loading') return;
        const stream = await camera.requestCamera();
        if (stream && videoRef.current) {
            engine.startDetection(videoRef.current);
            setDispatchEnabled(true);
        }
    }, [camera, engine, videoRef]);

    const handleStopEngine = useCallback(() => {
        engine.stopDetection();
        camera.stopCamera();
        setDispatchEnabled(false);
        onCursorMoveRef.current?.(0, 0, false);
    }, [camera, engine]);

    const handleToggleEngine = useCallback(() => {
        if (engine.status === 'running' || engine.status === 'loading') {
            handleStopEngine();
        } else {
            void handleActivateEngine();
        }
    }, [engine.status, handleActivateEngine, handleStopEngine]);

    const handleAcceptPreset = useCallback((presetKey: string) => {
        const preset = ALL_PRESETS.find((p) => p.nameKey.endsWith(presetKey));
        if (preset) {
            setActiveMapping(preset.mapping);
            setHeadTrackingMode(preset.headTrackingMode);
        }
        setPresetSuggestion(null);
    }, []);

    const dismissPresetSuggestion = useCallback(
        () => setPresetSuggestion(null),
        [],
    );

    // ── Recenter cursor al centro del iframe (no del viewport) ───────────
    // HeadTracker trabaja en espacio de viewport [0, 1]. Para que el cursor
    // salte al centro del iframe, calculamos qué coordenada viewport
    // corresponde al centro del iframe y la pasamos como target.
    const engineRecenterCursor = engine.recenterCursor;
    const recenterCursor = useCallback(() => {
        const rect = iframeRectRef.current;
        if (rect && rect.width > 0 && rect.height > 0) {
            const targetX = (rect.left + rect.width / 2) / window.innerWidth;
            const targetY = (rect.top + rect.height / 2) / window.innerHeight;
            engineRecenterCursor(targetX, targetY);
            // Actualización imperativa inmediata — el cursor salta al centro
            // sin esperar al siguiente frame del worker.
            onCursorMoveRef.current?.(0.5, 0.5, true);
            handshakeSendCursor(0.5, 0.5);
        } else {
            engineRecenterCursor();
        }
    }, [engineRecenterCursor, handshakeSendCursor]);

    const handshakeReset = handshake.reset;
    const handleRetryGame = useCallback(() => {
        handshakeReset();
        const iframe = iframeRef.current;
        if (iframe) iframe.src = game.embed_url;
    }, [handshakeReset, iframeRef, game.embed_url]);

    // ── Effects ───────────────────────────────────────────────────────────

    // Conectar dispatcher al iframe tras handshake.
    // setTarget es imperativo (no setState) — lee iframeRef.current en effect.
    const dispatcherSetTarget = dispatcher.setTarget;
    useEffect(() => {
        if (handshake.status === 'authenticated') {
            const win = iframeRef.current?.contentWindow;
            if (win) dispatcherSetTarget(win);
        } else {
            dispatcherSetTarget(document);
        }
    }, [handshake.status, iframeRef, dispatcherSetTarget]);

    // Liberar teclas al perder foco — evita keydown bloqueados tras alt-tab.
    const releaseHeldKeys = dispatcher.releaseHeldKeys;
    useEffect(() => {
        const onHidden = () => {
            if (document.hidden) releaseHeldKeys();
        };
        const onBlur = () => releaseHeldKeys();
        document.addEventListener('visibilitychange', onHidden);
        window.addEventListener('blur', onBlur);
        return () => {
            document.removeEventListener('visibilitychange', onHidden);
            window.removeEventListener('blur', onBlur);
        };
    }, [releaseHeldKeys]);

    // Liberar teclas al parar el motor.
    useEffect(() => {
        if (engine.status !== 'running') releaseHeldKeys();
    }, [engine.status, releaseHeldKeys]);

    // Cleanup al desmontar.
    useEffect(() => {
        const eng = engineRef.current;
        const cam = cameraRef.current;
        return () => {
            eng.stopDetection();
            cam.stopCamera();
        };
    }, []);

    // ── Retorno ───────────────────────────────────────────────────────────
    return {
        sensitivity,
        headTrackingMode,
        dispatchEnabled: effectiveDispatchEnabled,
        lastGesture,
        hasGestureConfig,
        presetSuggestion,
        errorMessage: engine.error ?? camera.error ?? null,

        engine,
        handshake,

        handleToggleEngine,
        handleRetryGame,
        recenterCursor,
        handleAcceptPreset,
        setDispatchEnabled,
        setSensitivity,
        dismissPresetSuggestion,
    };
}
