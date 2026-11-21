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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GestureEngineController } from '@/lib/mediapipe/gesture-engine';
import type { GestureEngineDiagnostics } from '@/lib/mediapipe/gesture-engine';
import { createGestureWorker } from '@/lib/mediapipe/gesture-worker-factory';
import type {
    HeadTrackerConfig,
    HeadTrackPosition,
} from '@/lib/mediapipe/head-tracker';
import {
    MEDIAPIPE_VERSION,
    resolveRuntimeAssets,
} from '@/lib/mediapipe/runtime-assets';
import { TelemetryCollector } from '@/lib/mediapipe/telemetry';
import type {
    EngineInfo,
    EngineStatus,
    GestureEvent,
    HeadPose,
    NeutralBaseline,
    PerformanceMetrics,
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
     * Expone `headPose`, `headTrackPosition`, `blendshapes` y `lastGesture`
     * como estado (como mucho una vez por fotograma de pantalla). Solo para
     * pantallas que los pintan. Por defecto `false`: esos valores quedan a
     * null y los callbacks siguen llegando igual.
     */
    liveState?: boolean;
};

type UseGestureEngineReturn = {
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
    error: string | null;
    /** Versión de MediaPipe, delegado y GPU con que corre el motor. */
    info: EngineInfo | null;
    telemetry: TelemetryCollector;
    /** Estado interno para la telemetría (modo de la cámara, fotogramas). */
    getDiagnostics: () => GestureEngineDiagnostics;
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
        liveState = false,
    } = options;

    const [status, setStatus] = useState<EngineStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [perf, setPerf] = useState<PerformanceMetrics | null>(null);
    const [baseline, setBaseline] = useState<NeutralBaseline | null>(null);
    const [info, setInfo] = useState<EngineInfo | null>(null);
    const [lastGesture, setLastGesture] = useState<GestureEvent | null>(null);
    const [headPose, setHeadPose] = useState<HeadPose | null>(null);
    const [headTrackPosition, setHeadTrackPosition] =
        useState<HeadTrackPosition | null>(null);
    const [blendshapes, setBlendshapes] = useState<Record<
        string,
        number
    > | null>(null);

    const telemetry = useMemo(() => new TelemetryCollector(), []);
    const controllerRef = useRef<GestureEngineController | null>(null);
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);

    // Valores que cambian sin que deba recrearse nada: se leen en callbacks.
    const latestRef = useRef({
        sensitivity,
        enableBlendshapes,
        headTrackerConfig,
        liveState,
        onGesture,
        onHeadPose,
        onHeadMove,
        onCalibrated,
    });

    useEffect(() => {
        latestRef.current = {
            sensitivity,
            enableBlendshapes,
            headTrackerConfig,
            liveState,
            onGesture,
            onHeadPose,
            onHeadMove,
            onCalibrated,
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

    /** El controlador se crea la primera vez que se usa, nunca en render. */
    const getController = useCallback((): GestureEngineController => {
        if (controllerRef.current !== null) {
            return controllerRef.current;
        }

        const latest = latestRef.current;

        controllerRef.current = new GestureEngineController({
            createWorker: createGestureWorker,
            resolveAssets: () => resolveRuntimeAssets(),
            mediapipeVersion: MEDIAPIPE_VERSION,
            getVideo: () =>
                externalVideoRef?.current ?? internalVideoRef.current,
            telemetry,
            config: {
                sensitivity: latest.sensitivity,
                enableBlendshapes: latest.enableBlendshapes,
            },
            headTracker: latest.headTrackerConfig,
            events: {
                onStatusChange: setStatus,
                onError: setError,
                onInfo: setInfo,
                onMetrics: setPerf,
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

        return controllerRef.current;
    }, [externalVideoRef, telemetry, queueLiveState]);

    // -----------------------------------------------------------------------
    // Métodos públicos
    // -----------------------------------------------------------------------

    const startDetection = useCallback(
        (video: HTMLVideoElement) => {
            internalVideoRef.current = video;

            const controller = getController();

            controller.setSensitivity(latestRef.current.sensitivity);
            controller.setEnableBlendshapes(
                latestRef.current.enableBlendshapes,
            );
            controller.start();
        },
        [getController],
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
                frameSource: 'idle',
                frames: { sent: 0, completed: 0, skipped: 0 },
            },
        [],
    );

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
        error,
        info,
        telemetry,
        getDiagnostics,
    };
}
