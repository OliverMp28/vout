import { Head } from '@inertiajs/react';
import {
    Activity,
    Brain,
    Crosshair,
    Download,
    Eye,
    Gauge,
    Loader2,
    Pause,
    Play,
    RotateCcw,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { CameraPreview } from '@/components/vision/camera-preview';
import { FaceMeshView } from '@/components/vision/face-mesh-view';
import {
    GestureRecordingPanel,
    useGestureRecorder,
} from '@/components/vision/gesture-recording-panel';
import { GestureStatusIndicator } from '@/components/vision/gesture-status-indicator';
import { useActionDispatcher } from '@/hooks/use-action-dispatcher';
import { useCamera } from '@/hooks/use-camera';
import { useGestureEngine } from '@/hooks/use-gesture-engine';
import AppLayout from '@/layouts/app-layout';
import { ALL_PRESETS, PRESET_PLATFORMER } from '@/lib/mediapipe/action-presets';
import type {
    ActionTrigger,
    GameAction,
    GestureActionMapping,
    HeadTrackingMode,
} from '@/lib/mediapipe/action-types';
import { describeDiagnostics } from '@/lib/mediapipe/diagnostics';
import type { RecordingMeta } from '@/lib/mediapipe/gesture-recording';
import type { TelemetrySnapshot } from '@/lib/mediapipe/telemetry';
import { GestureType } from '@/lib/mediapipe/types';
import type {
    CalibrationState,
    GestureEvent,
    MeshLevel,
    PreferredDelegate,
    PreviewMode,
} from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GestureLogEntry = GestureEvent & { id: number };

type DispatchLogEntry = {
    id: number;
    gestureLabel: string;
    actionLabel: string;
    timestamp: number;
};

const GESTURE_LABELS: Record<string, string> = {
    [GestureType.BrowRaise]: 'Brow Raise',
    [GestureType.MouthOpen]: 'Mouth Open',
    [GestureType.BlinkLeft]: 'Blink Left',
    [GestureType.BlinkRight]: 'Blink Right',
    [GestureType.Smile]: 'Smile',
    [GestureType.BrowFrown]: 'Brow Frown',
    [GestureType.MouthPucker]: 'Mouth Pucker',
};

function actionLabel(
    mapping: GestureActionMapping,
    gesture: ActionTrigger,
): string {
    const action = mapping[gesture];
    if (!action || action.type === 'none') return '—';
    switch (action.type) {
        case 'keyboard':
            return `⌨ ${action.key} (${action.mode})`;
        case 'mouse_click':
            return `🖱 Click ${action.button}`;
        case 'game_event':
            return `🎮 ${action.event}`;
    }
}

/** Estado de la calibración en pocas palabras (Vision Lab, sin traducir). */
function describeCalibration(calibration: CalibrationState): string {
    switch (calibration.status) {
        case 'idle':
            return 'Sin calibrar';
        case 'calibrating':
            return 'Calibrando: mira al frente, cara relajada…';
        case 'calibrated':
            return 'Calibrada';
        case 'failed':
            return `Calibración fallida (${calibration.reason})`;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VisionLab() {
    const [sensitivity, setSensitivity] = useState(5);
    const [gestureLog, setGestureLog] = useState<GestureLogEntry[]>([]);
    const [dispatchLog, setDispatchLog] = useState<DispatchLogEntry[]>([]);
    const [dispatchEnabled, setDispatchEnabled] = useState(false);
    const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
    const [telemetrySnap, setTelemetrySnap] =
        useState<TelemetrySnapshot | null>(null);
    // GPU o CPU: en algunas GPU integradas la CPU con SIMD rinde igual o más.
    const [delegate, setDelegate] = useState<PreferredDelegate>('GPU');
    // Vista de la cámara: para comparar la malla sobre el vídeo (fluido, la
    // malla algo por detrás) con la imagen que pinta el worker (todo junto,
    // al ritmo de la inferencia).
    const [meshLevel, setMeshLevel] = useState<MeshLevel>('full');
    const [previewMode, setPreviewMode] = useState<PreviewMode>('overlay');

    // Contexto que acompaña a la grabación guiada (se lee al terminarla).
    const recordingMetaRef = useRef<RecordingMeta>({
        info: null,
        sensitivity: 5,
        baseline: null,
        calibration: { status: 'idle' },
    });
    const recorder = useGestureRecorder(() => recordingMetaRef.current);

    const logIdRef = useRef(0);
    const dispatchLogIdRef = useRef(0);

    // Active mapping from the selected preset — memoized to keep dispatcher stable.
    const activeMapping = useMemo<GestureActionMapping>(
        () =>
            ALL_PRESETS[selectedPresetIndex]?.mapping ??
            PRESET_PLATFORMER.mapping,
        [selectedPresetIndex],
    );
    const activeHeadMode = useMemo<HeadTrackingMode>(
        () => ALL_PRESETS[selectedPresetIndex]?.headTrackingMode ?? 'disabled',
        [selectedPresetIndex],
    );

    // The videoRef is owned by this component — shared with useCamera and CameraPreview.
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const camera = useCamera({ videoRef });

    const dispatcher = useActionDispatcher({
        mapping: activeMapping,
        headTrackingMode: activeHeadMode,
        enabled: dispatchEnabled,
    });

    const handleGesture = useCallback(
        (event: GestureEvent) => {
            // Update gesture detection log.
            setGestureLog((prev) => {
                const entry = { ...event, id: ++logIdRef.current };
                const next = [entry, ...prev];
                return next.length > 20 ? next.slice(0, 20) : next;
            });

            // Dispatch action and add to dispatch log if enabled.
            dispatcher.onGesture(event);
            if (dispatchEnabled && event.phase !== 'end') {
                setDispatchLog((prev) => {
                    const entry: DispatchLogEntry = {
                        id: ++dispatchLogIdRef.current,
                        gestureLabel:
                            GESTURE_LABELS[event.gesture] ?? event.gesture,
                        actionLabel: actionLabel(activeMapping, event.gesture),
                        timestamp: event.timestamp,
                    };
                    const next = [entry, ...prev];
                    return next.length > 20 ? next.slice(0, 20) : next;
                });
            }
        },
        [dispatcher, dispatchEnabled, activeMapping],
    );

    const engine = useGestureEngine({
        sensitivity,
        onGesture: handleGesture,
        onHeadMove: dispatcher.onHeadMove,
        enableBlendshapes: true,
        // Vision Lab pinta la pose, el cursor y los blendshapes en vivo.
        liveState: true,
        delegate,
        onFrame: recorder.onFrame,
    });

    useEffect(() => {
        recordingMetaRef.current = {
            info: engine.info,
            sensitivity,
            baseline: engine.baseline,
            calibration: engine.calibration,
        };
    });

    // Stable refs for cleanup without causing effect re-runs.
    const engineRef = useRef(engine);
    const cameraRef = useRef(camera);

    useEffect(() => {
        engineRef.current = engine;
        cameraRef.current = camera;
    });

    // Release held keys whenever the engine is no longer running.
    // Prevents inputs staying "stuck" when the user pauses or stops detection.
    const releaseHeldKeys = dispatcher.releaseHeldKeys;
    useEffect(() => {
        if (engine.status !== 'running') {
            releaseHeldKeys();
        }
    }, [engine.status, releaseHeldKeys]);

    // Telemetry display loop
    useEffect(() => {
        if (engine.status !== 'running' && engine.status !== 'paused') return;
        const interval = setInterval(() => {
            setTelemetrySnap(engine.telemetry.snapshot());
        }, 500);
        return () => clearInterval(interval);
    }, [engine.status, engine.telemetry]);

    const handleExportTelemetry = useCallback(() => {
        const csv = engine.telemetry.export(
            describeDiagnostics(engine.getDiagnostics()),
        );
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vout_telemetry_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [engine]);

    const handleStart = useCallback(async () => {
        // El motor (con el delegado elegido) se prepara mientras se abre la
        // cámara.
        engine.prewarm();
        const stream = await camera.requestCamera();
        if (stream && videoRef.current) {
            engine.startDetection(videoRef.current);
        }
    }, [camera, engine]);

    const handleStop = useCallback(() => {
        engine.stopDetection();
        camera.stopCamera();
    }, [engine, camera]);

    // Cleanup on unmount — capture current refs into local vars.
    useEffect(() => {
        const currentEngine = engineRef.current;
        const currentCamera = cameraRef.current;
        return () => {
            currentEngine.stopDetection();
            currentCamera.stopCamera();
        };
    }, []);

    // -----------------------------------------------------------------------
    // Blendshape bars (sorted by value desc)
    // -----------------------------------------------------------------------

    const sortedBlendshapes = engine.blendshapes
        ? Object.entries(engine.blendshapes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 20)
        : [];

    return (
        <AppLayout>
            <Head title="Vision Lab" />

            <div
                className="mx-auto max-w-7xl space-y-6 p-4 md:p-6"
                data-engine-status={engine.status}
            >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-surface-sunken p-2">
                            <Brain className="size-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">
                                Vision Lab
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                MediaPipe FaceLandmarker debug panel (dev-only)
                            </p>
                        </div>
                    </div>
                    <GestureStatusIndicator status={engine.status} />
                </div>

                {/* Camera / engine errors */}
                {(camera.error || engine.error) && (
                    <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-text">
                        {camera.error ?? engine.error}
                    </div>
                )}

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    {engine.status === 'idle' || engine.status === 'error' ? (
                        <Button
                            onClick={handleStart}
                            disabled={camera.status === 'requesting'}
                        >
                            {camera.status === 'requesting' ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Play className="size-4" />
                            )}
                            Start detection
                        </Button>
                    ) : (
                        <>
                            <Button variant="destructive" onClick={handleStop}>
                                Stop
                            </Button>
                            {engine.status === 'loading' ? (
                                <Button variant="secondary" disabled>
                                    <Loader2 className="size-4 animate-spin" />
                                    Loading model…
                                </Button>
                            ) : engine.status === 'running' ? (
                                <Button
                                    variant="secondary"
                                    onClick={engine.pauseDetection}
                                >
                                    <Pause className="size-4" />
                                    Pause
                                </Button>
                            ) : engine.status === 'paused' ? (
                                <Button
                                    variant="secondary"
                                    onClick={engine.resumeDetection}
                                >
                                    <Play className="size-4" />
                                    Resume
                                </Button>
                            ) : null}
                            <Button
                                variant="secondary"
                                onClick={engine.calibrateNeutral}
                                disabled={
                                    engine.status !== 'running' ||
                                    engine.calibration.status === 'calibrating'
                                }
                            >
                                <RotateCcw className="size-4" />
                                Calibrate neutral
                            </Button>
                            <span
                                className="text-xs text-muted-foreground"
                                data-calibration={engine.calibration.status}
                            >
                                {describeCalibration(engine.calibration)}
                            </span>
                        </>
                    )}

                    {(engine.status === 'idle' ||
                        engine.status === 'error') && (
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="vision-delegate"
                                className="text-xs"
                            >
                                Delegate
                            </Label>
                            <Select
                                value={delegate}
                                onValueChange={(value) =>
                                    setDelegate(value as PreferredDelegate)
                                }
                            >
                                <SelectTrigger
                                    id="vision-delegate"
                                    className="h-8 w-24 text-xs"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GPU">GPU</SelectItem>
                                    <SelectItem value="CPU">CPU</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Sensitivity</Label>
                        <Slider
                            value={[sensitivity]}
                            onValueChange={([v]) => setSensitivity(v)}
                            min={1}
                            max={10}
                            step={1}
                            className="w-32"
                        />
                        <span className="w-6 text-center text-xs text-muted-foreground tabular-nums">
                            {sensitivity}
                        </span>
                    </div>
                </div>

                {/* Main grid */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Camera preview + head tracking cursor */}
                    <div className="space-y-3">
                        <h2 className="flex items-center gap-2 text-sm font-medium">
                            <Eye className="size-4" />
                            Camera Feed
                        </h2>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Label
                                    htmlFor="vision-mesh-level"
                                    className="text-xs"
                                >
                                    Mesh
                                </Label>
                                <Select
                                    value={meshLevel}
                                    onValueChange={(value) =>
                                        setMeshLevel(value as MeshLevel)
                                    }
                                >
                                    <SelectTrigger
                                        id="vision-mesh-level"
                                        className="h-8 w-28 text-xs"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="off">Off</SelectItem>
                                        <SelectItem value="contours">
                                            Contours
                                        </SelectItem>
                                        <SelectItem value="full">
                                            Full mesh
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label
                                    htmlFor="vision-preview-mode"
                                    className="text-xs"
                                >
                                    View
                                </Label>
                                <Select
                                    value={previewMode}
                                    onValueChange={(value) =>
                                        setPreviewMode(value as PreviewMode)
                                    }
                                >
                                    <SelectTrigger
                                        id="vision-preview-mode"
                                        className="h-8 w-44 text-xs"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="overlay">
                                            Overlay (video + mesh)
                                        </SelectItem>
                                        <SelectItem value="synced">
                                            Synced (worker image)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="relative">
                            <CameraPreview
                                ref={videoRef}
                                active={camera.status === 'active'}
                            >
                                <FaceMeshView
                                    engine={engine}
                                    mode={previewMode}
                                    mesh={meshLevel}
                                    className={cn(
                                        'absolute inset-0',
                                        previewMode === 'synced' && 'bg-media',
                                    )}
                                />
                            </CameraPreview>

                            {/* Virtual cursor overlay */}
                            {engine.headTrackPosition &&
                                engine.status === 'running' && (
                                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                                        <div
                                            className="absolute size-5 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75"
                                            style={{
                                                left: `${engine.headTrackPosition.x * 100}%`,
                                                top: `${engine.headTrackPosition.y * 100}%`,
                                            }}
                                        >
                                            <div className="size-full rounded-full border-2 border-on-media bg-signal/70" />
                                            <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                                        </div>
                                    </div>
                                )}
                        </div>

                        {/* Head pose + tracking coords */}
                        {engine.headPose && (
                            <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Crosshair className="size-3" />
                                    Head Tracking
                                </h3>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    {(['yaw', 'pitch', 'roll'] as const).map(
                                        (axis) => (
                                            <div key={axis}>
                                                <div className="text-[10px] text-muted-foreground uppercase">
                                                    {axis}
                                                </div>
                                                <div className="font-mono text-sm tabular-nums">
                                                    {(
                                                        engine.headPose![axis] *
                                                        45
                                                    ).toFixed(1)}
                                                    °
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>
                                {engine.headTrackPosition && (
                                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/30 pt-2 text-center">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase">
                                                Cursor X
                                            </div>
                                            <div className="font-mono text-sm tabular-nums">
                                                {(
                                                    engine.headTrackPosition.x *
                                                    100
                                                ).toFixed(1)}
                                                %
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase">
                                                Cursor Y
                                            </div>
                                            <div className="font-mono text-sm tabular-nums">
                                                {(
                                                    engine.headTrackPosition.y *
                                                    100
                                                ).toFixed(1)}
                                                %
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Blendshape monitor */}
                    <div className="space-y-3">
                        <h2 className="flex items-center gap-2 text-sm font-medium">
                            <Activity className="size-4" />
                            Blendshapes (top 20)
                        </h2>
                        <div className="h-[420px] space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-background/50 p-3">
                            {sortedBlendshapes.length === 0 ? (
                                <p className="py-8 text-center text-xs text-muted-foreground">
                                    Start detection to see blendshapes
                                </p>
                            ) : (
                                sortedBlendshapes.map(([name, value]) => (
                                    <div
                                        key={name}
                                        className="flex items-center gap-2"
                                    >
                                        <span className="w-36 truncate text-[10px] text-muted-foreground">
                                            {name}
                                        </span>
                                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-100',
                                                    value > 0.5
                                                        ? 'bg-success'
                                                        : 'bg-primary/60',
                                                )}
                                                style={{
                                                    width: `${Math.min(100, value * 100)}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="w-10 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                                            {value.toFixed(2)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right panel: telemetry, performance + gesture log */}
                    <div className="space-y-4">
                        {/* Telemetry */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-sm font-medium">
                                    <Activity className="size-4" />
                                    Telemetry
                                </h2>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-6 text-[10px]"
                                        onClick={() => {
                                            engine.telemetry.reset();
                                            setTelemetrySnap(null);
                                        }}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-6 text-[10px]"
                                        onClick={handleExportTelemetry}
                                        disabled={
                                            !telemetrySnap ||
                                            Object.keys(telemetrySnap)
                                                .length === 0
                                        }
                                    >
                                        <Download className="mr-1 size-3" />
                                        CSV
                                    </Button>
                                </div>
                            </div>
                            <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                                {telemetrySnap &&
                                Object.keys(telemetrySnap).length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-4 gap-2 border-b border-border/30 pb-1 text-center text-[10px] tracking-wider text-muted-foreground uppercase">
                                            <div className="text-left font-semibold">
                                                Metric
                                            </div>
                                            <div className="font-semibold">
                                                P50
                                            </div>
                                            <div className="font-semibold">
                                                P95
                                            </div>
                                            <div className="font-semibold">
                                                Avg
                                            </div>
                                        </div>
                                        {Object.entries(telemetrySnap)
                                            .sort()
                                            .map(([key, stats]) => (
                                                <div
                                                    key={key}
                                                    className="grid grid-cols-4 items-center gap-2 text-center font-mono text-xs"
                                                >
                                                    <div
                                                        className="truncate text-left font-sans text-[11px] text-muted-foreground"
                                                        title={key}
                                                    >
                                                        {key}
                                                    </div>
                                                    <div
                                                        className={
                                                            key ===
                                                                'inferenceMs' &&
                                                            stats.p50 > 30
                                                                ? 'font-medium text-danger-text'
                                                                : ''
                                                        }
                                                    >
                                                        {stats.p50.toFixed(1)}
                                                    </div>
                                                    <div
                                                        className={
                                                            key ===
                                                                'inferenceMs' &&
                                                            stats.p95 > 50
                                                                ? 'font-medium text-danger-text'
                                                                : ''
                                                        }
                                                    >
                                                        {stats.p95.toFixed(1)}
                                                    </div>
                                                    <div>
                                                        {stats.avg.toFixed(1)}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <p className="py-2 text-center text-xs text-muted-foreground">
                                        No telemetry data
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Grabación guiada para ajustar la detección */}
                        <GestureRecordingPanel
                            recorder={recorder}
                            canRecord={engine.status === 'running'}
                        />

                        {/* Performance */}
                        <div className="space-y-3">
                            <h2 className="flex items-center gap-2 text-sm font-medium">
                                <Gauge className="size-4" />
                                Performance
                            </h2>
                            <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                                {engine.performance ? (
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase">
                                                FPS
                                            </div>
                                            <div className="font-mono text-lg tabular-nums">
                                                {engine.performance.fps}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase">
                                                Inference
                                            </div>
                                            <div className="font-mono text-lg tabular-nums">
                                                {engine.performance.inferenceMs}
                                                ms
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase">
                                                Camera
                                            </div>
                                            <div className="font-mono text-lg tabular-nums">
                                                {engine.performance.cameraFps ??
                                                    '—'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="py-2 text-center text-xs text-muted-foreground">
                                        Waiting for data...
                                    </p>
                                )}
                                {engine.info && (
                                    <p
                                        id="vision-engine-info"
                                        className="mt-3 truncate border-t border-border/30 pt-2 text-center font-mono text-[10px] text-muted-foreground"
                                        title={
                                            engine.info.renderer ?? undefined
                                        }
                                    >
                                        MediaPipe {engine.info.mediapipeVersion}{' '}
                                        · {engine.info.delegate} ·{' '}
                                        {engine.info.renderer ?? 'no WebGL'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Baseline status */}
                        {engine.baseline && (
                            <div className="rounded-lg border border-success/30 bg-success-soft p-3">
                                <p className="text-xs text-success-text">
                                    Neutral baseline captured at{' '}
                                    {new Date(
                                        engine.baseline.capturedAt,
                                    ).toLocaleTimeString()}
                                </p>
                            </div>
                        )}

                        {/* Gesture event log */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-medium">
                                    Gesture Log
                                </h2>
                                {gestureLog.length > 0 && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setGestureLog([])}
                                        className="h-6 text-[10px]"
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                            <div className="h-56 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-background/50 p-3">
                                {gestureLog.length === 0 ? (
                                    <p className="py-8 text-center text-xs text-muted-foreground">
                                        No gestures detected yet
                                    </p>
                                ) : (
                                    gestureLog.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="flex animate-in items-center justify-between rounded-md px-2 py-1 text-xs transition-colors fade-in slide-in-from-top-1"
                                        >
                                            <Badge
                                                variant="secondary"
                                                className="font-mono text-[10px]"
                                            >
                                                {GESTURE_LABELS[
                                                    entry.gesture
                                                ] ?? entry.gesture}
                                            </Badge>
                                            <span className="font-mono text-muted-foreground">
                                                {entry.confidence.toFixed(2)} @{' '}
                                                {new Date(
                                                    entry.timestamp,
                                                ).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---- Action Dispatch Panel ---- */}
                <div className="rounded-lg border border-border-strong bg-surface-sunken p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 text-sm font-medium">
                            <Zap className="size-4 text-primary" />
                            Action Dispatch
                        </h2>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Preset selector */}
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">
                                    Preset
                                </Label>
                                <Select
                                    value={String(selectedPresetIndex)}
                                    onValueChange={(v) =>
                                        setSelectedPresetIndex(Number(v))
                                    }
                                >
                                    <SelectTrigger size="sm" className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ALL_PRESETS.map((preset, i) => (
                                            <SelectItem
                                                key={preset.nameKey}
                                                value={String(i)}
                                            >
                                                {preset.nameKey
                                                    .split('.')
                                                    .pop()}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Enable/disable toggle */}
                            <div className="flex items-center gap-2">
                                <Label
                                    htmlFor="dispatch-toggle"
                                    className="text-xs text-muted-foreground"
                                >
                                    Dispatch enabled
                                </Label>
                                <Switch
                                    id="dispatch-toggle"
                                    checked={dispatchEnabled}
                                    onCheckedChange={setDispatchEnabled}
                                />
                            </div>

                            {dispatchLog.length > 0 && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setDispatchLog([])}
                                    className="h-6 text-[10px]"
                                >
                                    Clear log
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Active mapping summary */}
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {(
                            Object.entries(activeMapping) as [
                                ActionTrigger,
                                GameAction | undefined,
                            ][]
                        ).map(([trigger, action]) => {
                            if (!action || action.type === 'none') return null;
                            const label = GESTURE_LABELS[trigger] ?? trigger;
                            const aLabel = actionLabel(activeMapping, trigger);
                            return (
                                <div
                                    key={trigger}
                                    className="flex items-center gap-1 rounded border border-border/40 bg-background/60 px-2 py-0.5 text-[10px]"
                                >
                                    <span className="text-muted-foreground">
                                        {label}
                                    </span>
                                    <span className="text-muted-foreground">
                                        →
                                    </span>
                                    <span className="font-mono">{aLabel}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Dispatch log */}
                    <div className="h-40 space-y-1 overflow-y-auto rounded-lg border border-border/40 bg-background/50 p-3">
                        {!dispatchEnabled ? (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                Enable dispatch to see actions fired in
                                real-time
                            </p>
                        ) : dispatchLog.length === 0 ? (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                Waiting for gestures...
                            </p>
                        ) : (
                            dispatchLog.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="flex animate-in items-center justify-between rounded-md px-2 py-1 text-xs fade-in slide-in-from-top-1"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className="font-mono text-[10px]"
                                        >
                                            {entry.gestureLabel}
                                        </Badge>
                                        <span className="text-primary">
                                            {entry.actionLabel}
                                        </span>
                                    </div>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        {new Date(
                                            entry.timestamp,
                                        ).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
