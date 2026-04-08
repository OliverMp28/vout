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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useActionDispatcher } from '@/hooks/use-action-dispatcher';
import { useCamera } from '@/hooks/use-camera';
import { useGestureEngine } from '@/hooks/use-gesture-engine';
import { useIframeHandshake } from '@/hooks/use-iframe-handshake';
import { transformCursorToIframe } from '@/lib/iframe/cursor-forwarder';
import { ALL_PRESETS, PRESET_PLATFORMER } from '@/lib/mediapipe/action-presets';
import type { GestureActionMapping, HeadTrackingMode } from '@/lib/mediapipe/action-types';
import type { HeadTrackPosition } from '@/lib/mediapipe/head-tracker';
import type { GestureConfigData, GestureEvent, GestureType } from '@/lib/mediapipe/types';

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
    const baseMapping = activeGestureConfig?.gesture_mapping ?? PRESET_PLATFORMER.mapping;
    const baseHeadMode = activeGestureConfig?.head_tracking_mode ?? 'disabled';

    // ── Estado de UI ──────────────────────────────────────────────────────
    const [sensitivity, setSensitivity] = useState(baseSensitivity);
    const [activeMapping, setActiveMapping] = useState<GestureActionMapping>(baseMapping);
    const [headTrackingMode, setHeadTrackingMode] = useState<HeadTrackingMode>(baseHeadMode);
    const [dispatchEnabled, setDispatchEnabled] = useState(false);
    const [lastGesture, setLastGesture] = useState<GestureType | null>(null);
    const [presetSuggestion, setPresetSuggestion] = useState<string | null>(null);

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
    // Solo apunta al iframe cuando el handshake está autenticado.
    const dispatcherTarget = useMemo<EventTarget | undefined>(() => {
        if (handshake.status !== 'authenticated') return undefined;
        return iframeRef.current?.contentWindow ?? undefined;
    }, [handshake.status, iframeRef]);

    const dispatcher = useActionDispatcher({
        mapping: activeMapping,
        headTrackingMode,
        enabled: dispatchEnabled,
        target: dispatcherTarget,
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

    const dispatcherOnHeadMove = dispatcher.onHeadMove;
    const handshakeSendCursor = handshake.sendCursor;
    const handleHeadMove = useCallback(
        (position: HeadTrackPosition) => {
            dispatcherOnHeadMove(position);

            if (headTrackingMode !== 'cursor') {
                onCursorMoveRef.current?.(0, 0, false);
                return;
            }

            const iframe = iframeRef.current;
            if (!iframe) return;

            const rect = iframe.getBoundingClientRect();
            const transformed = transformCursorToIframe(
                position,
                rect,
                window.innerWidth,
                window.innerHeight,
            );

            // Actualización imperativa — no pasa por setState, evita reconciliación
            // React a ~30fps solo por mover el cursor.
            onCursorMoveRef.current?.(transformed.x, transformed.y, true);
            handshakeSendCursor(transformed.x, transformed.y);
        },
        // iframeRef es estable; headTrackingMode se lee fuera del array para
        // evitar re-crear el callback al cambiar, con lectura controlada.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [dispatcherOnHeadMove, handshakeSendCursor, headTrackingMode, iframeRef],
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
        if (engine.status === 'running') {
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

    const dismissPresetSuggestion = useCallback(() => setPresetSuggestion(null), []);

    // ── Effects ───────────────────────────────────────────────────────────

    // Liberar teclas al perder foco — evita keydown bloqueados tras alt-tab.
    const releaseHeldKeys = dispatcher.releaseHeldKeys;
    useEffect(() => {
        const onHidden = () => { if (document.hidden) releaseHeldKeys(); };
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

    // Si el handshake cae a error, deshabilitar el dispatch.
    useEffect(() => {
        if (handshake.status === 'error') setDispatchEnabled(false);
    }, [handshake.status]);

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
        dispatchEnabled,
        lastGesture,
        hasGestureConfig,
        presetSuggestion,
        errorMessage: engine.error ?? camera.error ?? null,

        engine,
        handshake,

        handleToggleEngine,
        handleAcceptPreset,
        setDispatchEnabled,
        setSensitivity,
        dismissPresetSuggestion,
    };
}
