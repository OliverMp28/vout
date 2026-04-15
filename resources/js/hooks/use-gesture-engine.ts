import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CAPTURE_HEIGHT, CAPTURE_WIDTH, DEFAULT_MODEL_PATH, WASM_CDN_PATH } from '@/lib/mediapipe/constants';
import { HeadTracker } from '@/lib/mediapipe/head-tracker';
import type { HeadTrackerConfig, HeadTrackPosition } from '@/lib/mediapipe/head-tracker';
import { TelemetryCollector } from '@/lib/mediapipe/telemetry';
import type {
    EngineStatus,
    GestureEvent,
    HeadPose,
    NeutralBaseline,
    PerformanceMetrics,
    WorkerConfig,
    WorkerInMessage,
    WorkerOutMessage,
} from '@/lib/mediapipe/types';

// Producción: ?worker&inline bundlea el worker completo como base64 en build.
// Vite crea internamente un Blob URL del mismo origen — sin CORS.
// En dev mode este import genera un WorkerWrapper inerte (nunca lo instanciamos
// directamente en dev, usamos el blob shim de createGestureWorker).
import InlinedGestureWorker from '../workers/gesture-detector.worker.ts?worker&inline';

// ---------------------------------------------------------------------------
// Factory de Worker con solución cross-origin para dev mode
// ---------------------------------------------------------------------------

/** Timeout de inicialización: si el worker no envía READY en este tiempo, abortar. */
const INIT_TIMEOUT_MS = 30_000;

/**
 * Crea el Worker de detección de gestos de forma compatible tanto en dev como
 * en producción.
 *
 * **Problema en dev:** Vite dev server corre en puerto 5173 y Laravel Sail en
 * puerto 80. Los navegadores bloquean `new Worker(url)` si `url` apunta a un
 * origen distinto (SecurityError). `?worker&inline` solo inlinea en build de
 * producción; en dev Vite sigue generando un WorkerWrapper que referencia al
 * dev server → misma SecurityError.
 *
 * **Solución (recomendada por Vite, ref: vitejs/vite#13680):** Crear un Blob
 * URL del mismo origen que la página cuyo contenido es un `import` ES module
 * del source real en el dev server. El constructor `new Worker(blobUrl)` pasa
 * la validación de same-origin, y dentro del worker el `import` se resuelve
 * vía CORS (permitido para module imports).
 *
 * El shim es mínimo a propósito: solo define `self.import` (polyfill que Vite
 * necesita en dev) e importa el worker real. NO hay fake DOM ni hiding de
 * importScripts — `vision_bundle.mjs` es un ESM bundle que usa `fetch()` +
 * `WebAssembly.compile()` internamente, no necesita DOM.
 *
 * **Producción:** `?worker&inline` bundlea todo como base64 → Blob URL mismo
 * origen automáticamente.
 *
 * @returns Tupla [worker, blobUrl] — blobUrl es null en prod, se debe revocar
 *          con URL.revokeObjectURL al destruir el worker para evitar memory leaks.
 */
function createGestureWorker(): [Worker, string | null] {
    if (import.meta.env.DEV) {
        // import.meta.url apunta al módulo actual servido por Vite (puerto 5173).
        // ?worker_file&type=module indica al dev server que procese el archivo para
        // contexto de worker (sin HMR preamble ni código de navegador).
        const devWorkerUrl = new URL(
            '../workers/gesture-detector.worker.ts?worker_file&type=module',
            import.meta.url,
        ).href;

        // Shim con dos polyfills necesarios:
        //
        // 1. importScripts — vision_bundle.mjs usa importScripts() para cargar
        //    WASM glue code (vision_wasm_internal.js). En module workers el
        //    nativo lanza "Module scripts don't support importScripts()".
        //    Lo reemplazamos con XMLHttpRequest síncrono + eval, que preserva
        //    la semántica síncrona que MediaPipe espera. Sync XHR está permitido
        //    en cualquier tipo de worker (classic o module).
        //
        // 2. self.import — Vite emite llamadas a self.import() para carga
        //    dinámica de módulos en dev. La mapeamos al import() nativo.
        const shimSource = [
            `self.importScripts = (...urls) => {`,
            `  for (const url of urls) {`,
            `    const xhr = new XMLHttpRequest();`,
            `    xhr.open('GET', url, false);`,
            `    xhr.send();`,
            `    if (xhr.status >= 200 && xhr.status < 300) {`,
            `      (0, eval)(xhr.responseText);`,
            `    } else {`,
            `      throw new Error('importScripts failed: ' + url + ' status=' + xhr.status);`,
            `    }`,
            `  }`,
            `};`,
            `self.import = (url) => import(url);`,
            `import ${JSON.stringify(devWorkerUrl)};`,
        ].join('\n');

        const blob = new Blob([shimSource], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        return [new Worker(blobUrl, { type: 'module' }), blobUrl];
    }

    // Producción: InlinedGestureWorker es un constructor que Vite genera desde
    // el base64 inlineado — Blob URL del mismo origen, sin CORS.
    return [new InlinedGestureWorker(), null];
}

// ---------------------------------------------------------------------------
// Opciones y tipo de retorno
// ---------------------------------------------------------------------------

type UseGestureEngineOptions = {
    /** Sensibilidad del usuario (1-10). */
    sensitivity?: number;
    /**
     * Ref externa al elemento <video> del consumidor.
     *
     * Si se proporciona, el loop de captura lee de esta ref en cada frame
     * en lugar de almacenar una copia interna. Esto permite que el elemento
     * <video> se recree (ej. cuando el wizard cambia de paso y monta un
     * nuevo CameraPreview) sin perder la referencia.
     *
     * Si no se proporciona, startDetection() almacena el elemento internamente
     * (comportamiento original — válido cuando el <video> no cambia).
     */
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    /** Callback cuando se detecta un gesto. */
    onGesture?: (event: GestureEvent) => void;
    /** Callback con la orientación de la cabeza cada frame. */
    onHeadPose?: (pose: HeadPose) => void;
    /** Callback con la posición del cursor virtual (head tracking). */
    onHeadMove?: (position: HeadTrackPosition) => void;
    /** Callback cuando la calibración neutral se completa. */
    onCalibrated?: (baseline: NeutralBaseline) => void;
    /** Si true, emite datos raw de blendshapes (para Vision Lab). */
    enableBlendshapes?: boolean;
    /** Configuración del head tracker (zona muerta, suavizado, inversión). */
    headTrackerConfig?: Partial<HeadTrackerConfig>;
};

type UseGestureEngineReturn = {
    status: EngineStatus;
    startDetection: (video: HTMLVideoElement) => void;
    stopDetection: () => void;
    calibrateNeutral: () => void;
    recenterCursor: (targetX?: number, targetY?: number) => void;
    pauseDetection: () => void;
    resumeDetection: () => void;
    lastGesture: GestureEvent | null;
    headPose: HeadPose | null;
    headTrackPosition: HeadTrackPosition | null;
    blendshapes: Record<string, number> | null;
    performance: PerformanceMetrics | null;
    baseline: NeutralBaseline | null;
    error: string | null;
    telemetry: TelemetryCollector;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGestureEngine(options: UseGestureEngineOptions = {}): UseGestureEngineReturn {
    const { sensitivity = 5, videoRef: externalVideoRef, onGesture, onHeadPose, onHeadMove, onCalibrated, enableBlendshapes = false, headTrackerConfig } = options;

    const [status, setStatus] = useState<EngineStatus>('idle');
    const [lastGesture, setLastGesture] = useState<GestureEvent | null>(null);
    const [headPose, setHeadPose] = useState<HeadPose | null>(null);
    const [headTrackPosition, setHeadTrackPosition] = useState<HeadTrackPosition | null>(null);
    const [blendshapes, setBlendshapes] = useState<Record<string, number> | null>(null);
    const [perf, setPerf] = useState<PerformanceMetrics | null>(null);
    const [baseline, setBaseline] = useState<NeutralBaseline | null>(null);
    const [error, setError] = useState<string | null>(null);

    const headTrackerRef = useRef(new HeadTracker(headTrackerConfig));
    /** Últimos valores raw pasados a HeadTracker.update(), necesarios para recenter(). */
    const lastRawHeadRef = useRef({ horizontal: 0, vertical: 0 });
    const telemetry = useMemo(() => new TelemetryCollector(), []);
    const lastTelemetryTimeRef = useRef(0);
    const workerRef = useRef<Worker | null>(null);
    const blobUrlRef = useRef<string | null>(null); // Blob URL del shim (solo dev)
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    // Si el consumidor pasa su propio videoRef, el capture loop lee de él
    // (permite que el <video> se recree entre pasos del wizard sin perder la ref).
    const videoRef = externalVideoRef ?? internalVideoRef;
    const rafRef = useRef(0);
    const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFrameTimeRef = useRef(0);
    // Sesión 3.2 — arranque optimista a 60fps. El PerformanceAdapter del
    // worker degrada a un tier inferior si el device no sostiene el ritmo.
    const intervalMsRef = useRef(1000 / 60);
    // Sesión 3.6 — ref que espeja `status` para que el capture loop pueda
    // consultarlo sin depender de closures stale. Gated a 10fps mientras el
    // motor está cargando (MediaPipe aún no procesa frames).
    const statusRef = useRef<EngineStatus>('idle');

    // Refs estables para valores que cambian pero que no deben re-crear callbacks.
    // Se sincronizan en un effect (no durante render) para cumplir react-hooks/refs.
    const sensitivityRef = useRef(sensitivity);
    const enableBlendshapesRef = useRef(enableBlendshapes);
    const onGestureRef = useRef(onGesture);
    const onHeadPoseRef = useRef(onHeadPose);
    const onHeadMoveRef = useRef(onHeadMove);
    const onCalibratedRef = useRef(onCalibrated);

    useEffect(() => {
        sensitivityRef.current = sensitivity;
        enableBlendshapesRef.current = enableBlendshapes;
        onGestureRef.current = onGesture;
        onHeadPoseRef.current = onHeadPose;
        onHeadMoveRef.current = onHeadMove;
        onCalibratedRef.current = onCalibrated;
        statusRef.current = status;
    });

    // -----------------------------------------------------------------------
    // Manejador de mensajes del Worker
    // -----------------------------------------------------------------------

    const handleWorkerMessage = useCallback((e: MessageEvent<WorkerOutMessage>) => {
        const msg = e.data;

        switch (msg.type) {
            case 'READY':
                // Modelo cargado — el warm-up frame se envía desde el listener
                // onReady de startDetection. NO seteamos 'running' aquí: la
                // primera llamada a detectForVideo compila shaders GPU
                // (~200-500ms). Status se mantiene en 'loading' hasta que el
                // primer RESULT confirme que el pipeline está listo.
                break;

            case 'RESULT':
                // Warm-up completo: el primer RESULT mientras 'loading' confirma
                // que los shaders GPU están compilados. Arrancar el capture loop
                // real y transicionar a 'running'.
                if (statusRef.current === 'loading') {
                    statusRef.current = 'running';
                    setStatus('running');
                    if (captureLoopRef.current) {
                        rafRef.current = requestAnimationFrame(captureLoopRef.current);
                    }
                }
                for (const gesture of msg.gestures) {
                    setLastGesture(gesture);
                    onGestureRef.current?.(gesture);
                }
                if (msg.headPose) {
                    setHeadPose(msg.headPose);
                    onHeadPoseRef.current?.(msg.headPose);

                    // Mapear orientación de cabeza a coordenadas de pantalla suavizadas.
                    // Negaciones empíricamente verificadas — ver comentario en HeadTracker.update().
                    const rawH = -msg.headPose.pitch;
                    const rawV = -msg.headPose.roll;
                    lastRawHeadRef.current = { horizontal: rawH, vertical: rawV };
                    const pos = headTrackerRef.current.update(rawH, rawV);
                    setHeadTrackPosition(pos);
                    onHeadMoveRef.current?.(pos);
                }
                break;

            case 'BLENDSHAPES':
                setBlendshapes(msg.values);
                break;

            case 'PERFORMANCE': {
                setPerf(msg.metrics);
                // El PerformanceAdapter del worker aplica histéresis (±10%) y
                // camina los FPS_TIERS de constants.ts — la lógica vive en un
                // único lugar. Aquí solo consumimos el resultado.
                intervalMsRef.current = 1000 / msg.metrics.targetFps;
                break;
            }

            case 'CALIBRATED':
                setBaseline(msg.baseline);
                onCalibratedRef.current?.(msg.baseline);
                break;

            case 'TELEMETRY': {
                const now = performance.now();
                telemetry.push('inferenceMs', msg.inferenceMs);
                telemetry.push('e2eCursorLatencyMs', now - msg.frameTimestamp);
                
                const lastTelemetry = lastTelemetryTimeRef.current;
                if (lastTelemetry > 0 && now > lastTelemetry) {
                    telemetry.push('engineFps', 1000 / (now - lastTelemetry));
                }
                lastTelemetryTimeRef.current = now;
                break;
            }

            case 'ERROR':
                setError(msg.message);
                setStatus('error');
                break;
        }
    }, [telemetry]);

    // Ref para el loop de captura — se define dentro de startDetection y se
    // reutiliza en resumeDetection. Evita el antipatrón de useCallback auto-referencial.
    const captureLoopRef = useRef<(() => void) | null>(null);

    /** Limpia timeouts y blob URLs sin terminar el worker. */
    const clearInitTimeout = useCallback(() => {
        if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
            initTimeoutRef.current = null;
        }
    }, []);

    // -----------------------------------------------------------------------
    // Métodos públicos
    // -----------------------------------------------------------------------

    const startDetection = useCallback(
        (video: HTMLVideoElement) => {
            if (workerRef.current) return;

            setStatus('loading');
            setError(null);
            // Almacenar la referencia al video solo en la ref interna.
            // Si el consumidor pasa su propia ref, no la mutamos aquí.
            internalVideoRef.current = video;

            const [worker, blobUrl] = createGestureWorker();
            blobUrlRef.current = blobUrl;

            worker.addEventListener('message', handleWorkerMessage);
            workerRef.current = worker;

            // Capturar errores no manejados del worker (ej. si el import del CDN
            // falla con CORS, o si un módulo no se resuelve).
            worker.addEventListener('error', (e) => {
                console.error('[GestureEngine] Worker uncaught error:', e.message);
                setError(e.message ?? 'Worker encountered an unexpected error');
                setStatus('error');
                clearInitTimeout();
            });

            // El worker corre desde un Blob URL — las rutas relativas como
            // "/models/face_landmarker.task" no se resuelven correctamente.
            // Convertimos a URL absoluta usando el origen de la página.
            const rawModelPath = import.meta.env.VITE_MEDIAPIPE_MODEL_PATH ?? DEFAULT_MODEL_PATH;
            const modelPath = rawModelPath.startsWith('/')
                ? `${window.location.origin}${rawModelPath}`
                : rawModelPath;

            const workerConfig: WorkerConfig = {
                sensitivity: sensitivityRef.current,
                // Sesión 3.2 — arrancar optimista. El PerformanceAdapter del
                // worker degrada si el device no sostiene el ritmo.
                targetFps: 60,
                enableBlendshapes: enableBlendshapesRef.current,
            };

            const initMsg: WorkerInMessage = {
                type: 'INIT',
                modelPath,
                wasmPath: WASM_CDN_PATH,
                config: workerConfig,
            };
            worker.postMessage(initMsg);

            // Loop de captura — video → ImageBitmap → transferencia al worker.
            // Definido como closure local para evitar useCallback auto-referencial.
            const loop = () => {
                const vid = videoRef.current;
                const w = workerRef.current;

                if (!vid || !w || vid.readyState < 2) {
                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }

                const now = performance.now();
                // Sesión 3.6 — durante `loading` el worker no procesa frames
                // (espera READY). Bajamos a 10fps para no malgastar CPU
                // creando ImageBitmaps que se descartan.
                const effectiveInterval = statusRef.current === 'loading' ? 100 : intervalMsRef.current;
                if (now - lastFrameTimeRef.current < effectiveInterval) {
                    telemetry.push('frameDropRate', 1);
                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }
                
                telemetry.push('frameDropRate', 0);
                if (lastFrameTimeRef.current > 0) {
                    telemetry.push('captureFps', 1000 / (now - lastFrameTimeRef.current));
                }
                lastFrameTimeRef.current = now;

                createImageBitmap(vid, {
                    resizeWidth: CAPTURE_WIDTH,
                    resizeHeight: CAPTURE_HEIGHT,
                })
                    .then((bitmap) => {
                        w.postMessage(
                            { type: 'FRAME', bitmap, timestamp: now } satisfies WorkerInMessage,
                            [bitmap],
                        );
                    })
                    .catch(() => {
                        // La captura de frame puede fallar transitoriamente — omitir.
                    });

                rafRef.current = requestAnimationFrame(loop);
            };
            // Puente entre callbacks hermanos: handleWorkerMessage (case RESULT)
            // y resumeDetection necesitan acceder a este closure local.
            // La regla react-hooks/immutability es formalmente estricta aquí
            // pero no detecta un bug real — la asignación ocurre síncronamente
            // antes de que cualquier message del worker pueda leer el ref.
            // eslint-disable-next-line react-hooks/immutability
            captureLoopRef.current = loop;

            // Timeout de seguridad: si READY no llega en INIT_TIMEOUT_MS, asumir
            // que la inicialización colgó (ej. el CDN no responde, WASM no carga).
            initTimeoutRef.current = setTimeout(() => {
                if (workerRef.current === worker) {
                    console.error('[GestureEngine] Init timeout — READY not received within', INIT_TIMEOUT_MS, 'ms');
                    setError('Gesture engine timed out during initialization. Check browser console for details.');
                    setStatus('error');
                }
            }, INIT_TIMEOUT_MS);

            // Warm-up: al recibir READY, enviamos UN solo frame para que el
            // worker compile los shaders GPU (~200-500ms). El capture loop
            // real no arranca hasta que el primer RESULT confirme que el
            // pipeline está listo (ver handleWorkerMessage RESULT case).
            //
            // ¿Por qué no arrancar el loop a 10fps como antes?
            // Incluso a 10fps, durante la compilación de shaders se acumulan
            // 2-5 frames. Cada uno se procesa secuencialmente al terminar la
            // compilación, provocando un breve "catch-up" con movimientos
            // retrasados. Un solo frame = cero acumulación = transición limpia.
            const sendWarmupFrame = () => {
                const vid = videoRef.current;
                const w = workerRef.current;
                if (!vid || !w || vid.readyState < 2) {
                    rafRef.current = requestAnimationFrame(sendWarmupFrame);
                    return;
                }
                createImageBitmap(vid, {
                    resizeWidth: CAPTURE_WIDTH,
                    resizeHeight: CAPTURE_HEIGHT,
                })
                    .then((bitmap) => {
                        w.postMessage(
                            { type: 'FRAME', bitmap, timestamp: performance.now() } satisfies WorkerInMessage,
                            [bitmap],
                        );
                    })
                    .catch(() => {
                        rafRef.current = requestAnimationFrame(sendWarmupFrame);
                    });
            };

            const onReady = (e: MessageEvent<WorkerOutMessage>) => {
                if (e.data.type === 'READY') {
                    clearInitTimeout();
                    sendWarmupFrame();
                    worker.removeEventListener('message', onReady);
                }
            };
            worker.addEventListener('message', onReady);
        },
        [handleWorkerMessage, clearInitTimeout, videoRef, telemetry],
    );

    const stopDetection = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        clearInitTimeout();

        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'DESTROY' } satisfies WorkerInMessage);
            workerRef.current.terminate();
            workerRef.current = null;
        }

        // Liberar Blob URL del shim de dev para evitar memory leaks.
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }

        // Solo limpiar la ref interna — si el consumidor pasa su propia ref
        // externa, no debemos anularla (el consumidor la gestiona).
        internalVideoRef.current = null;
        headTrackerRef.current.reset();
        setStatus('idle');
        setLastGesture(null);
        setHeadPose(null);
        setHeadTrackPosition(null);
        setBlendshapes(null);
        setPerf(null);
        setError(null);
    }, [clearInitTimeout]);

    const calibrateNeutral = useCallback(() => {
        workerRef.current?.postMessage({ type: 'CALIBRATE_NEUTRAL' } satisfies WorkerInMessage);
    }, []);

    /**
     * Recentra el cursor de head-tracking usando la posición actual como nuevo centro.
     *
     * @param targetX  Posición X destino en viewport [0, 1] (default 0.5).
     * @param targetY  Posición Y destino en viewport [0, 1] (default 0.5).
     */
    const recenterCursor = useCallback((targetX?: number, targetY?: number) => {
        const { horizontal, vertical } = lastRawHeadRef.current;
        headTrackerRef.current.recenter(horizontal, vertical, targetX, targetY);
    }, []);

    const pauseDetection = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        workerRef.current?.postMessage({ type: 'PAUSE' } satisfies WorkerInMessage);
        setStatus('paused');
    }, []);

    const resumeDetection = useCallback(() => {
        workerRef.current?.postMessage({ type: 'RESUME' } satisfies WorkerInMessage);
        setStatus('running');
        if (captureLoopRef.current) {
            rafRef.current = requestAnimationFrame(captureLoopRef.current);
        }
    }, []);

    // Sincronizar sensibilidad con el worker cuando cambia.
    useEffect(() => {
        if (workerRef.current && status === 'running') {
            workerRef.current.postMessage({
                type: 'SET_CONFIG',
                config: { sensitivity },
            } satisfies WorkerInMessage);
        }
    }, [sensitivity, status]);

    // Sincronizar configuración del head tracker cuando cambia.
    useEffect(() => {
        if (headTrackerConfig) {
            headTrackerRef.current.setConfig(headTrackerConfig);
        }
    }, [headTrackerConfig]);

    // Cleanup al desmontar.
    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current);
            if (initTimeoutRef.current) {
                clearTimeout(initTimeoutRef.current);
            }
            if (workerRef.current) {
                workerRef.current.postMessage({ type: 'DESTROY' } satisfies WorkerInMessage);
                workerRef.current.terminate();
                workerRef.current = null;
            }
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
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
        telemetry,
    };
}
