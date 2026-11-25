/**
 * Orquestador de estado para la página de juego embebido.
 *
 * Extrae toda la lógica de `play/game.tsx` — estado, hooks, callbacks y
 * effects — dejando el componente como render puro.
 *
 * Responsabilidades:
 * - Inicializar `useGameSession`, `useIframeHandshake`, `useActionDispatcher`,
 *   `useGestureEngine` y `useCamera` con el cableado correcto entre ellos.
 * - Exponer handlers estables para los controles de UI.
 * - Gestionar el ciclo de vida completo: liberar teclas en blur/visibilitychange,
 *   detener motor y cámara al desmontar.
 * - Preparar el motor antes de activar cuando el usuario usa el control facial
 *   (`preload-policy.ts`): una vez cargado el juego, sin cámara.
 * - Decidir qué controles se usan: los del usuario o los que sugiere el juego
 *   (`lib/play/preset-choice.ts`), con la respuesta guardada por juego.
 * - Encender la cámara sola a quien lo autorizó, con aviso de 3 s
 *   (`use-play-autostart.ts`), y pausarla o apagarla con la pestaña oculta
 *   (`use-hidden-tab-policy.ts`).
 */

import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useActionDispatcher } from '@/hooks/use-action-dispatcher';
import { useCamera } from '@/hooks/use-camera';
import type { CameraIssue } from '@/hooks/use-camera';
import {
    useEngineWarmup,
    usePreloadDecision,
} from '@/hooks/use-engine-preload';
import { useGameSession } from '@/hooks/use-game-session';
import type { GameSessionPayload } from '@/hooks/use-game-session';
import { useGestureEngine } from '@/hooks/use-gesture-engine';
import { useHiddenTabPolicy } from '@/hooks/use-hidden-tab-policy';
import { useIframeHandshake } from '@/hooks/use-iframe-handshake';
import { usePlayAutostart } from '@/hooks/use-play-autostart';
import type { PlayAutostart } from '@/hooks/use-play-autostart';
import { transformCursorToIframe } from '@/lib/iframe/cursor-forwarder';
import { sendJson } from '@/lib/json-request';
import {
    PRESET_PLATFORMER,
    findPresetByKey,
} from '@/lib/mediapipe/action-presets';
import type { HeadTrackingMode } from '@/lib/mediapipe/action-types';
import type { CameraDevice } from '@/lib/mediapipe/camera-devices';
import { TELEMETRY_KEYS } from '@/lib/mediapipe/gesture-engine';
import type { HeadTrackPosition } from '@/lib/mediapipe/head-tracker';
import type {
    GestureConfigData,
    GestureEvent,
    GestureType,
} from '@/lib/mediapipe/types';
import { resolvePresetChoice } from '@/lib/play/preset-choice';
import { index as catalogIndex } from '@/routes/catalog';
import { update as updatePresetChoice } from '@/routes/play/preset';
import type { FacialControlSupport } from '@/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type GameInfo = {
    name: string;
    slug: string;
    embed_url: string;
    effective_origins: string[];
    /** Si recibe los controles de Vout (sin ellos no se ofrece la cámara). */
    facial_control_support: FacialControlSupport;
};

type UserInfo = {
    vout_id: string;
    name: string;
};

export type UsePlayOrchestratorOptions = {
    game: GameInfo;
    activeGestureConfig: GestureConfigData | null;
    /**
     * Qué respondió el usuario a los controles que sugiere este juego (la
     * clave del preset, `own` o null si nunca se le preguntó).
     */
    presetChoice: string | null;
    /**
     * Sesión de juego inicial emitida por `PlayController`. Null si el juego
     * no recibe identidad (invitado, o juego que no usa la cuenta): el juego
     * recibe VOUT_GUEST.
     */
    session: GameSessionPayload | null;
    /**
     * Encender la cámara sola al cargar el juego: el usuario lo autorizó, el
     * juego lo admite y tiene perfil de gestos.
     */
    autostartWanted?: boolean;
    /** Quien juega con su cuenta, o null si es un invitado. */
    user: UserInfo | null;
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
    /** Preset que sugiere el juego (si existe), o null. */
    suggestedPreset: string | null;
    /** Preset del juego en uso en lugar de los controles propios, o null. */
    activeGamePreset: string | null;
    /** Hay que preguntar si se usan los controles del juego. */
    askPresetChoice: boolean;
    /** Encendido automático de la cámara (aviso, cuenta atrás, "Ahora no"). */
    autostart: PlayAutostart;
    /** La cámara se apagó por dejar la pestaña oculta (hasta que se reactive). */
    stoppedWhileHidden: boolean;
    dismissHiddenStop: () => void;
    errorMessage: string | null;

    // ── Subsistemas ────────────────────────────────────────────────────────
    engine: ReturnType<typeof useGestureEngine>;
    handshake: ReturnType<typeof useIframeHandshake>;
    /** Estado de la cámara que la interfaz necesita mostrar. */
    camera: {
        /** Cámaras disponibles. Vacío hasta abrir una por primera vez. */
        cameras: CameraDevice[];
        /** Cámara en uso, o null. */
        activeCameraId: string | null;
        /** True mientras se abre una cámara y se espera su primera imagen. */
        busy: boolean;
        /** Por qué no hay cámara, o null. */
        issue: CameraIssue | null;
        /** Cámara descartada por no dar imagen cuando se acabó usando otra. */
        skippedCamera: string | null;
    };

    // ── Handlers de UI ────────────────────────────────────────────────────
    handleToggleEngine: () => void;
    /**
     * El usuario se acerca a "Activar" (ratón encima o foco): se empieza a
     * preparar el motor para que al pulsar ya esté (o casi).
     */
    handleEngineIntent: () => void;
    handleRetryGame: () => void;
    /** Cambia de cámara; si no se consigue abrir ninguna, detiene el motor. */
    handleSelectCamera: (deviceId: string) => void;
    /** Recentra el cursor al centro del iframe (no del viewport). */
    recenterCursor: () => void;
    /**
     * Elige los controles de este juego: la clave del preset sugerido o
     * `own` (los propios). Se guarda para no volver a preguntar.
     */
    choosePreset: (choice: string) => void;
    setDispatchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    setSensitivity: React.Dispatch<React.SetStateAction<number>>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlayOrchestrator({
    game,
    activeGestureConfig,
    presetChoice: initialPresetChoice,
    session: initialSession,
    autostartWanted = false,
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
    const [dispatchEnabled, setDispatchEnabled] = useState(false);
    const [lastGesture, setLastGesture] = useState<GestureType | null>(null);
    const [suggestedPreset, setSuggestedPreset] = useState<string | null>(null);
    const [storedPresetChoice, setStoredPresetChoice] =
        useState(initialPresetChoice);
    // Encendida (sola o a mano) en esta visita: el encendido automático no
    // vuelve a intentarlo, salvo tras apagarse por la pestaña oculta.
    const [cameraAttempted, setCameraAttempted] = useState(false);
    const [stoppedWhileHidden, setStoppedWhileHidden] = useState(false);

    const hasGestureConfig = activeGestureConfig !== null;
    const gameSupportsFacialControl = game.facial_control_support !== 'none';

    // Controles en uso: los del juego si los eligió (o si está probando sin
    // perfil), los suyos si no. Se calcula, no se copia a otro estado.
    const presetResolution = resolvePresetChoice({
        suggested: suggestedPreset,
        stored: storedPresetChoice,
        trial: !hasGestureConfig,
    });
    const gamePreset =
        presetResolution.gamePreset === null
            ? undefined
            : findPresetByKey(presetResolution.gamePreset);
    const activeMapping = gamePreset?.mapping ?? baseMapping;
    const headTrackingMode: HeadTrackingMode =
        gamePreset?.headTrackingMode ?? baseHeadMode;

    // ── Sesión de juego ────────────────────────────────────────────────────
    // Token vigente para el iframe. Se renueva solo antes de caducar; cada
    // sesión nueva la reenvía el handshake al juego con otro VOUT_AUTH.
    const { session, endReason: sessionEndReason } = useGameSession({
        gameSlug: game.slug,
        voutId: initialSession && user ? user.vout_id : null,
        initialSession,
    });

    // La sesión web pasó a ser de otra cuenta (cambio de usuario en otra
    // pestaña): esta página se renderizó para el usuario anterior. La
    // recargamos entera para que portal y juego arranquen con la cuenta
    // correcta, en lugar de mezclar identidades a mitad de partida.
    useEffect(() => {
        if (sessionEndReason === 'account_changed') {
            window.location.reload();
        }
    }, [sessionEndReason]);

    // ── Handshake con el iframe ────────────────────────────────────────────
    // Solo se ofrecen presets que existen: el valor llega de un origen
    // externo y uno desconocido dejaría un banner cuyo "Aplicar" no hace nada.
    const handleReady = useCallback((suggested?: string) => {
        if (suggested && findPresetByKey(suggested)) {
            setSuggestedPreset(suggested);
        }
    }, []);

    // El juego pidió salir (EXIT). El destino lo decide el portal, nunca el
    // mensaje: así un juego no puede usar EXIT para redirigir al usuario.
    const handleExit = useCallback(() => {
        router.visit(catalogIndex.url());
    }, []);

    // Lo que VOUT_AUTH cuenta del jugador; sin sesión no se cuenta nada.
    const voutId = user?.vout_id ?? null;
    const userName = user?.name ?? null;
    const player = useMemo(
        () =>
            initialSession !== null && voutId !== null && userName !== null
                ? { voutId, username: userName }
                : null,
        [initialSession, voutId, userName],
    );

    const handshake = useIframeHandshake({
        iframeRef,
        allowedOrigins: game.effective_origins,
        session,
        sessionEndReason:
            sessionEndReason === 'account_changed' ? null : sessionEndReason,
        player,
        onReady: handleReady,
        onExit: handleExit,
    });

    // ── Dispatcher ────────────────────────────────────────────────────────
    // El target no se pasa como prop (requeriría leer iframeRef.current durante
    // render). Se conecta imperativamente en un useEffect más abajo, una vez
    // que handshake.status cambia a 'connected'.
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
            if (event.phase !== 'end') {
                setLastGesture(event.gesture);
            }
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
        (position: HeadTrackPosition, frameTimestamp: number) => {
            dispatcherOnHeadMove(position, frameTimestamp);

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
    // Para quien usa el control facial, el motor se prepara en cuanto el
    // juego ha cargado (no compite con él) y sigue cargado mientras se esté
    // en la página: activar solo tiene que abrir la cámara.
    const preloadDecision = usePreloadDecision('play', {
        hasProfile: hasGestureConfig,
        gameSupportsFacialControl,
    });

    const engine = useGestureEngine({
        sensitivity,
        videoRef,
        onGesture: handleGesture,
        onHeadMove: handleHeadMove,
        enableBlendshapes: false,
        // La cara neutra se toma sola al arrancar, en cuanto el usuario mira
        // de frente y relajado; el panel permite repetirla.
        autoCalibrate: true,
        keepWarm: preloadDecision === 'warm',
    });

    const engineTelemetry = engine.telemetry;
    const enginePrewarm = engine.prewarm;

    useEngineWarmup(
        preloadDecision,
        handshake.status === 'connected',
        enginePrewarm,
    );

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
        // La apertura puede tardar (espera a la primera imagen): un segundo
        // clic mientras tanto no debe lanzar otra.
        if (camera.status === 'requesting') return;
        setCameraAttempted(true);
        setStoppedWhileHidden(false);
        // El motor se prepara mientras se abre la cámara, no después.
        engine.prewarm();
        const requestedAt = performance.now();
        const stream = await camera.requestCamera();
        if (stream && videoRef.current) {
            engineTelemetry.push(
                TELEMETRY_KEYS.cameraOpenMs,
                performance.now() - requestedAt,
            );
            engine.startDetection(videoRef.current);
            setDispatchEnabled(true);
        }
    }, [camera, engine, engineTelemetry, videoRef]);

    // También sin perfil: puede estar a punto de pulsar "Probar ahora".
    const handleEngineIntent = useCallback(() => {
        if (gameSupportsFacialControl) enginePrewarm();
    }, [gameSupportsFacialControl, enginePrewarm]);

    const handleStopEngine = useCallback(() => {
        engine.stopDetection();
        camera.stopCamera();
        setDispatchEnabled(false);
        onCursorMoveRef.current?.(0, 0, false);
    }, [camera, engine]);

    // ── Pestaña oculta: pausar y, tras 1 minuto, apagar la cámara ─────────
    // Con la pestaña oculta no llegan imágenes, pero la cámara seguiría
    // encendida (con su luz) hasta salir del juego.
    const engineStatusRef = useRef(engine.status);
    useEffect(() => {
        engineStatusRef.current = engine.status;
    });
    const activeWhenHiddenRef = useRef(false);
    const enginePause = engine.pauseDetection;
    const engineResume = engine.resumeDetection;

    useHiddenTabPolicy({
        onHide: () => {
            const status = engineStatusRef.current;
            activeWhenHiddenRef.current =
                status === 'running' || status === 'loading';

            if (activeWhenHiddenRef.current) {
                enginePause();
            }
        },
        onLongHidden: () => {
            if (!activeWhenHiddenRef.current) {
                return;
            }

            activeWhenHiddenRef.current = false;
            handleStopEngine();
            setStoppedWhileHidden(true);
            // Quien la tiene en automático la recupera al volver (con aviso).
            setCameraAttempted(false);
        },
        onReturn: (kind) => {
            if (
                kind === 'short' &&
                activeWhenHiddenRef.current &&
                engineStatusRef.current === 'paused'
            ) {
                engineResume();
            }

            activeWhenHiddenRef.current = false;
        },
    });

    const dismissHiddenStop = useCallback(
        () => setStoppedWhileHidden(false),
        [],
    );

    // ── Encendido automático ──────────────────────────────────────────────
    const autostart = usePlayAutostart({
        wanted: autostartWanted && gameSupportsFacialControl,
        gameReady: handshake.status === 'connected',
        engineIdle: engine.status === 'idle' || engine.status === 'ready',
        attempted: cameraAttempted,
        onStart: () => void handleActivateEngine(),
    });

    const handleSelectCamera = useCallback(
        (deviceId: string) => {
            void camera.selectCamera(deviceId).then((opened) => {
                // Ninguna cámara responde: sin imagen el motor no hace nada,
                // así que se detiene y el panel explica el motivo.
                if (!opened) handleStopEngine();
            });
        },
        [camera, handleStopEngine],
    );

    const handleToggleEngine = useCallback(() => {
        if (
            engine.status === 'running' ||
            engine.status === 'loading' ||
            engine.status === 'paused'
        ) {
            handleStopEngine();
        } else {
            void handleActivateEngine();
        }
    }, [engine.status, handleActivateEngine, handleStopEngine]);

    const gameSlug = game.slug;
    const hasAccount = user !== null;
    const choosePreset = useCallback(
        (choice: string) => {
            setStoredPresetChoice(choice);
            // De un invitado no se guarda nada: vale solo para esta visita.
            if (!hasAccount) return;
            void sendJson(updatePresetChoice.url(gameSlug), 'PUT', { choice });
            // Para que volver atrás a esta página no vuelva a preguntar. Solo
            // cambia esta prop: el resto conserva su identidad (un `game` o
            // una `session` nuevos reiniciarían el handshake).
            router.replace({
                preserveScroll: true,
                preserveState: true,
                props: (props) => ({ ...props, presetChoice: choice }),
            });
        },
        [gameSlug, hasAccount],
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
        if (handshake.status === 'connected') {
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
        suggestedPreset,
        activeGamePreset: gamePreset ? presetResolution.gamePreset : null,
        askPresetChoice: presetResolution.ask,
        autostart,
        stoppedWhileHidden,
        dismissHiddenStop,
        errorMessage: engine.error ?? camera.error ?? null,

        engine,
        handshake,
        camera: {
            cameras: camera.cameras,
            activeCameraId: camera.activeCameraId,
            busy: camera.status === 'requesting',
            issue: camera.issue,
            skippedCamera: camera.skippedCamera,
        },

        handleToggleEngine,
        handleEngineIntent,
        handleRetryGame,
        handleSelectCamera,
        recenterCursor,
        choosePreset,
        setDispatchEnabled,
        setSensitivity,
    };
}
