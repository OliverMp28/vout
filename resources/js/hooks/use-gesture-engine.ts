/**
 * Adaptador React del motor de gestos (`lib/mediapipe/gesture-engine.ts`).
 *
 * El motor vive fuera de React: los callbacks por fotograma (`onGesture`,
 * `onHeadMove`, `onHeadPose`) se llaman de forma síncrona al llegar cada
 * resultado del worker, sin pasar por estado. Este hook solo convierte en
 * estado lo que la interfaz pinta y cambia poco: estado del motor, error,
 * métricas, línea base y la información del runtime.
 *
 * Lo que cambia en cada fotograma (pose, cursor, blendshapes, último gesto)
 * solo se expone como estado con `liveState: true`, y como mucho una vez por
 * `requestAnimationFrame`. La página de juego no lo usa: repintarla 30-60
 * veces por segundo competía con el juego por el hilo principal (el iframe
 * es del mismo *site* y comparte proceso).
 *
 * El motor cargado lo presta el host de la aplicación
 * (`lib/mediapipe/shared-runtime.ts`): `stopDetection` cierra la sesión pero
 * el motor queda en caliente, y `prewarm` lo prepara antes de activar. La
 * página que lo usa lo retiene mientras está montada (`keepWarm`, o desde su
 * primer arranque): así no caduca mientras se puede volver a activar.
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';

import type { RuntimeState } from '@/lib/mediapipe/engine-runtime';
import { GestureEngineController } from '@/lib/mediapipe/gesture-engine';
import type {
    GestureEngineDiagnostics,
    PreviewSurfaceLike,
} from '@/lib/mediapipe/gesture-engine';
import type {
    HeadTrackerConfig,
    HeadTrackPosition,
} from '@/lib/mediapipe/head-tracker';
import { sharedRuntimeHost } from '@/lib/mediapipe/shared-runtime';
import { TelemetryCollector } from '@/lib/mediapipe/telemetry';
import type {
    AnalyzedFrame,
    CalibrationState,
    EngineInfo,
    EngineStatus,
    GestureEvent,
    HeadPose,
    NeutralBaseline,
    PerformanceMetrics,
    PreferredDelegate,
    PreviewOptions,
} from '@/lib/mediapipe/types';

// ---------------------------------------------------------------------------
// Opciones y tipo de retorno
// ---------------------------------------------------------------------------

type UseGestureEngineOptions = {
    /** Sensibilidad del usuario (1-10). */
    sensitivity?: number;
    /**
     * Ref externa al elemento <video> del consumidor.
     *
     * Si se proporciona, el motor lee de esta ref en cada imagen en lugar de
     * guardar el elemento pasado a `startDetection()`. Así el <video> puede
     * recrearse (el asistente de calibración monta uno nuevo por paso) sin
     * perder la referencia.
     */
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    /**
     * Callback con cada evento de gesto: su inicio (`start`), mientras se
     * sostiene (`hold`) y su final (`end`).
     */
    onGesture?: (event: GestureEvent) => void;
    /** Callback con la orientación de la cabeza cada frame. */
    onHeadPose?: (pose: HeadPose) => void;
    /**
     * Callback con la posición del cursor virtual (head tracking) y la marca
     * del fotograma del que sale (línea de tiempo de `performance.now()`).
     */
    onHeadMove?: (position: HeadTrackPosition, frameTimestamp: number) => void;
    /** Callback cuando la calibración neutral se completa. */
    onCalibrated?: (baseline: NeutralBaseline) => void;
    /** Si true, el worker devuelve los 52 blendshapes (Vision Lab). */
    enableBlendshapes?: boolean;
    /** Configuración del head tracker (zona muerta, suavizado, inversión). */
    headTrackerConfig?: Partial<HeadTrackerConfig>;
    /**
     * Calibrar la cara neutra al arrancar (en cuanto el usuario mira de
     * frente con la cara relajada). Ver `calibration`.
     */
    autoCalibrate?: boolean;
    /** Delegado con que crear el landmarker (Vision Lab compara GPU y CPU). */
    delegate?: PreferredDelegate;
    /** Cada fotograma analizado (grabadora de Vision Lab). */
    onFrame?: (frame: AnalyzedFrame) => void;
    /**
     * Expone `headPose`, `headTrackPosition`, `blendshapes` y `lastGesture`
     * como estado (como mucho una vez por fotograma de pantalla). Solo para
     * pantallas que los pintan. Por defecto `false`: esos valores quedan a
     * null y los callbacks siguen llegando igual.
     */
    liveState?: boolean;
    /**
     * Retener el motor cargado mientras el componente esté montado, aunque
     * aún no se haya activado (la página precarga: ver `preload-policy.ts`).
     * Sin esto se retiene desde el primer arranque.
     */
    keepWarm?: boolean;
};

export type UseGestureEngineReturn = {
    status: EngineStatus;
    startDetection: (video: HTMLVideoElement) => void;
    stopDetection: () => void;
    calibrateNeutral: () => void;
    recenterCursor: (targetX?: number, targetY?: number) => void;
    pauseDetection: () => void;
    resumeDetection: () => void;
    /** Con `liveState`. */
    lastGesture: GestureEvent | null;
    /** Con `liveState`. */
    headPose: HeadPose | null;
    /** Con `liveState`. */
    headTrackPosition: HeadTrackPosition | null;
    /** Con `liveState` y `enableBlendshapes`. */
    blendshapes: Record<string, number> | null;
    performance: PerformanceMetrics | null;
    baseline: NeutralBaseline | null;
    /** Estado de la calibración de la cara neutra. */
    calibration: CalibrationState;
    error: string | null;
    /** Versión de MediaPipe, delegado y GPU con que corre el motor. */
    info: EngineInfo | null;
    telemetry: TelemetryCollector;
    /** Estado interno para la telemetría (modo de la cámara, fotogramas). */
    getDiagnostics: () => GestureEngineDiagnostics;
    /**
     * Prepara el motor sin cámara para que activar sea inmediato. No hace
     * nada si ya está cargado o cargándose.
     */
    prewarm: () => void;
    /**
     * Dibuja la vista de la cámara con la malla en `surface` mientras haya
     * una sesión (también en las siguientes). Devuelve cómo quitarla.
     */
    attachPreview: (
        surface: PreviewSurfaceLike,
        options: PreviewOptions,
    ) => () => void;
    /** Cambia el modo o la malla de la vista actual. */
    updatePreview: (options: PreviewOptions) => void;
};

type PreviewRegistration = {
    surface: PreviewSurfaceLike;
    options: PreviewOptions;
    /** Quita la vista del controlador actual. */
    detach: (() => void) | null;
};

type LiveState = {
    lastGesture: GestureEvent;
    headPose: HeadPose;
    headTrackPosition: HeadTrackPosition;
    blendshapes: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGestureEngine(
    options: UseGestureEngineOptions = {},
): UseGestureEngineReturn {
    const {
        sensitivity = 5,
        videoRef: externalVideoRef,
        onGesture,
        onHeadPose,
        onHeadMove,
        onCalibrated,
        enableBlendshapes = false,
        headTrackerConfig,
        autoCalibrate = false,
        delegate = 'GPU',
        onFrame,
        liveState = false,
        keepWarm = false,
    } = options;

    const [status, setStatus] = useState<EngineStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [perf, setPerf] = useState<PerformanceMetrics | null>(null);
    const [baseline, setBaseline] = useState<NeutralBaseline | null>(null);
    const [calibration, setCalibration] = useState<CalibrationState>({
        status: 'idle',
    });
    const [info, setInfo] = useState<EngineInfo | null>(null);
    const [lastGesture, setLastGesture] = useState<GestureEvent | null>(null);
    const [headPose, setHeadPose] = useState<HeadPose | null>(null);
    const [headTrackPosition, setHeadTrackPosition] =
        useState<HeadTrackPosition | null>(null);
    const [blendshapes, setBlendshapes] = useState<Record<
        string,
        number
    > | null>(null);

    const [startedOnce, setStartedOnce] = useState(false);

    const telemetry = useMemo(() => new TelemetryCollector(), []);
    const controllerRef = useRef<GestureEngineController | null>(null);
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    // La vista de la cámara se registra antes de arrancar y pasa a cada
    // controlador nuevo.
    const previewRef = useRef<PreviewRegistration | null>(null);

    // Valores que cambian sin que deba recrearse nada: se leen en callbacks.
    const latestRef = useRef({
        sensitivity,
        enableBlendshapes,
        headTrackerConfig,
        autoCalibrate,
        delegate,
        liveState,
        onGesture,
        onHeadPose,
        onHeadMove,
        onCalibrated,
        onFrame,
    });

    useEffect(() => {
        latestRef.current = {
            sensitivity,
            enableBlendshapes,
            headTrackerConfig,
            autoCalibrate,
            delegate,
            liveState,
            onGesture,
            onHeadPose,
            onHeadMove,
            onCalibrated,
            onFrame,
        };
    });

    // Estado por fotograma acumulado hasta el próximo frame de pantalla.
    const pendingLiveRef = useRef<Partial<LiveState>>({});
    const liveFrameRef = useRef<number | null>(null);

    const queueLiveState = useCallback((patch: Partial<LiveState>) => {
        if (!latestRef.current.liveState) {
            return;
        }

        Object.assign(pendingLiveRef.current, patch);

        if (liveFrameRef.current !== null) {
            return;
        }

        liveFrameRef.current = requestAnimationFrame(() => {
            liveFrameRef.current = null;

            const pending = pendingLiveRef.current;
            pendingLiveRef.current = {};

            if (pending.lastGesture) setLastGesture(pending.lastGesture);
            if (pending.headPose) setHeadPose(pending.headPose);
            if (pending.headTrackPosition) {
                setHeadTrackPosition(pending.headTrackPosition);
            }
            if (pending.blendshapes) setBlendshapes(pending.blendshapes);
        });
    }, []);

    const clearLiveState = useCallback(() => {
        if (liveFrameRef.current !== null) {
            cancelAnimationFrame(liveFrameRef.current);
            liveFrameRef.current = null;
        }

        pendingLiveRef.current = {};
        setLastGesture(null);
        setHeadPose(null);
        setHeadTrackPosition(null);
        setBlendshapes(null);
    }, []);

    /**
     * El controlador se crea al arrancar, nunca en render. Se recrea en cada
     * arranque para aplicar el delegado y la calibración automática pedidos.
     */
    const createController = useCallback((): GestureEngineController => {
        const latest = latestRef.current;

        return new GestureEngineController({
            runtimeHost: sharedRuntimeHost,
            getVideo: () =>
                externalVideoRef?.current ?? internalVideoRef.current,
            telemetry,
            config: {
                sensitivity: latest.sensitivity,
                enableBlendshapes: latest.enableBlendshapes,
            },
            headTracker: latest.headTrackerConfig,
            delegate: latest.delegate,
            autoCalibrate: latest.autoCalibrate,
            events: {
                onStatusChange: setStatus,
                onError: setError,
                onInfo: setInfo,
                onMetrics: setPerf,
                onCalibrationChange: setCalibration,
                onFrame: (frame) => latestRef.current.onFrame?.(frame),
                onCalibrated: (captured) => {
                    setBaseline(captured);
                    latestRef.current.onCalibrated?.(captured);
                },
                onGesture: (event) => {
                    latestRef.current.onGesture?.(event);

                    // El final de un gesto no es "el último gesto detectado".
                    if (event.phase !== 'end') {
                        queueLiveState({ lastGesture: event });
                    }
                },
                onHeadPose: (pose) => {
                    latestRef.current.onHeadPose?.(pose);
                    queueLiveState({ headPose: pose });
                },
                onHeadMove: (position, frameTimestamp) => {
                    latestRef.current.onHeadMove?.(position, frameTimestamp);
                    queueLiveState({ headTrackPosition: position });
                },
                onBlendshapes: (values) =>
                    queueLiveState({ blendshapes: values }),
            },
        });
    }, [externalVideoRef, telemetry, queueLiveState]);

    // -----------------------------------------------------------------------
    // Métodos públicos
    // -----------------------------------------------------------------------

    const startDetection = useCallback(
        (video: HTMLVideoElement) => {
            if (
                controllerRef.current !== null &&
                controllerRef.current.status !== 'idle' &&
                controllerRef.current.status !== 'error'
            ) {
                return;
            }

            internalVideoRef.current = video;
            controllerRef.current?.stop();

            const controller = createController();
            const preview = previewRef.current;

            controllerRef.current = controller;

            if (preview !== null) {
                preview.detach = controller.attachPreview(
                    preview.surface,
                    preview.options,
                );
            }

            controller.start();
            setStartedOnce(true);
        },
        [createController],
    );

    const stopDetection = useCallback(() => {
        controllerRef.current?.stop();
        internalVideoRef.current = null;
        clearLiveState();
    }, [clearLiveState]);

    const calibrateNeutral = useCallback(() => {
        controllerRef.current?.calibrateNeutral();
    }, []);

    /**
     * Recentra el cursor de head-tracking usando la posición actual como nuevo centro.
     *
     * @param targetX  Posición X destino en viewport [0, 1] (default 0.5).
     * @param targetY  Posición Y destino en viewport [0, 1] (default 0.5).
     */
    const recenterCursor = useCallback((targetX?: number, targetY?: number) => {
        controllerRef.current?.recenter(targetX, targetY);
    }, []);

    const pauseDetection = useCallback(() => {
        controllerRef.current?.pause();
    }, []);

    const resumeDetection = useCallback(() => {
        controllerRef.current?.resume();
    }, []);

    const getDiagnostics = useCallback(
        (): GestureEngineDiagnostics =>
            controllerRef.current?.getDiagnostics() ?? {
                info: null,
                runtime: null,
                frameSource: 'idle',
                frames: { sent: 0, completed: 0, skipped: 0 },
            },
        [],
    );

    const prewarm = useCallback(() => {
        sharedRuntimeHost.prewarm(latestRef.current.delegate);
    }, []);

    const attachPreview = useCallback(
        (surface: PreviewSurfaceLike, previewOptions: PreviewOptions) => {
            previewRef.current?.detach?.();

            const registration: PreviewRegistration = {
                surface,
                options: previewOptions,
                detach:
                    controllerRef.current?.attachPreview(
                        surface,
                        previewOptions,
                    ) ?? null,
            };

            previewRef.current = registration;

            return () => {
                if (previewRef.current !== registration) {
                    return;
                }

                registration.detach?.();
                previewRef.current = null;
            };
        },
        [],
    );

    const updatePreview = useCallback((previewOptions: PreviewOptions) => {
        if (previewRef.current !== null) {
            previewRef.current.options = previewOptions;
        }

        controllerRef.current?.updatePreview(previewOptions);
    }, []);

    // Mientras la página puede volver a activar el control facial, el motor
    // cargado no caduca. Al salir de ella, el host lo mantiene un rato más.
    const retainRuntime = keepWarm || startedOnce;

    useEffect(() => {
        if (!retainRuntime) {
            return;
        }

        return sharedRuntimeHost.retain();
    }, [retainRuntime]);

    // Sincronizar configuración con el motor cuando cambia.
    useEffect(() => {
        controllerRef.current?.setSensitivity(sensitivity);
    }, [sensitivity]);

    useEffect(() => {
        controllerRef.current?.setEnableBlendshapes(enableBlendshapes);
    }, [enableBlendshapes]);

    useEffect(() => {
        if (headTrackerConfig) {
            controllerRef.current?.setHeadTrackerConfig(headTrackerConfig);
        }
    }, [headTrackerConfig]);

    // Cleanup al desmontar.
    useEffect(() => {
        return () => {
            controllerRef.current?.stop();

            if (liveFrameRef.current !== null) {
                cancelAnimationFrame(liveFrameRef.current);
            }
        };
    }, []);

    return {
        status,
        startDetection,
        stopDetection,
        calibrateNeutral,
        recenterCursor,
        pauseDetection,
        resumeDetection,
        lastGesture,
        headPose,
        headTrackPosition,
        blendshapes,
        performance: perf,
        baseline,
        calibration,
        error,
        info,
        telemetry,
        getDiagnostics,
        prewarm,
        attachPreview,
        updatePreview,
    };
}

/**
 * Estado del motor cargado de la aplicación (`none` si no hay ninguno): si
 * está preparándose, listo para la próxima activación o muerto.
 */
export function useWarmEngineState(): RuntimeState | 'none' {
    return useSyncExternalStore(
        (listener) => sharedRuntimeHost.subscribe(listener),
        () => sharedRuntimeHost.warmState,
        () => 'none',
    );
}
