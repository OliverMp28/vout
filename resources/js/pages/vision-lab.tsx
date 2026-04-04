import { Head } from '@inertiajs/react';
import { Activity, Brain, Crosshair, Eye, Gauge, Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CameraPreview } from '@/components/vision/camera-preview';
import { GestureStatusIndicator } from '@/components/vision/gesture-status-indicator';
import { useCamera } from '@/hooks/use-camera';
import { useGestureEngine } from '@/hooks/use-gesture-engine';
import AppLayout from '@/layouts/app-layout';
import { GestureType } from '@/lib/mediapipe/types';
import type { GestureEvent } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GestureLogEntry = GestureEvent & { id: number };

const GESTURE_LABELS: Record<string, string> = {
    [GestureType.BrowRaise]: 'Brow Raise',
    [GestureType.MouthOpen]: 'Mouth Open',
    [GestureType.BlinkLeft]: 'Blink Left',
    [GestureType.BlinkRight]: 'Blink Right',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VisionLab() {
    const [sensitivity, setSensitivity] = useState(5);
    const [gestureLog, setGestureLog] = useState<GestureLogEntry[]>([]);
    const logIdRef = useRef(0);

    // El videoRef es propiedad de este componente — se comparte con useCamera y CameraPreview.
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const camera = useCamera({ videoRef });

    const handleGesture = useCallback((event: GestureEvent) => {
        setGestureLog((prev) => {
            const entry = { ...event, id: ++logIdRef.current };
            const next = [entry, ...prev];
            return next.length > 20 ? next.slice(0, 20) : next;
        });
    }, []);

    const engine = useGestureEngine({
        sensitivity,
        onGesture: handleGesture,
        enableBlendshapes: true,
    });

    // Refs estables para cleanup sin causar re-ejecución del effect.
    // Se sincronizan en un effect (no durante render) para cumplir react-hooks/refs.
    const engineRef = useRef(engine);
    const cameraRef = useRef(camera);

    useEffect(() => {
        engineRef.current = engine;
        cameraRef.current = camera;
    });

    const handleStart = useCallback(async () => {
        const stream = await camera.requestCamera();
        if (stream && videoRef.current) {
            engine.startDetection(videoRef.current);
        }
    }, [camera, engine]);

    const handleStop = useCallback(() => {
        engine.stopDetection();
        camera.stopCamera();
    }, [engine, camera]);

    // Cleanup al desmontar — capturar refs en variables locales para que
    // el cleanup detenga la instancia correcta incluso si la ref cambia.
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

            <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Brain className="size-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Vision Lab</h1>
                            <p className="text-sm text-muted-foreground">
                                MediaPipe FaceLandmarker debug panel (dev-only)
                            </p>
                        </div>
                    </div>
                    <GestureStatusIndicator status={engine.status} />
                </div>

                {/* Errores de cámara o motor */}
                {(camera.error || engine.error) && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                        {camera.error ?? engine.error}
                    </div>
                )}

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    {engine.status === 'idle' || engine.status === 'error' ? (
                        <Button
                            onClick={handleStart}
                            disabled={camera.status === 'requesting' || engine.status === 'loading'}
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
                                <Button variant="secondary" onClick={engine.pauseDetection}>
                                    <Pause className="size-4" />
                                    Pause
                                </Button>
                            ) : engine.status === 'paused' ? (
                                <Button variant="secondary" onClick={engine.resumeDetection}>
                                    <Play className="size-4" />
                                    Resume
                                </Button>
                            ) : null}
                            {/* Solo permitir calibración cuando el motor está corriendo */}
                            <Button
                                variant="secondary"
                                onClick={engine.calibrateNeutral}
                                disabled={engine.status !== 'running'}
                            >
                                <RotateCcw className="size-4" />
                                Calibrate neutral
                            </Button>
                        </>
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
                        <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
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
                        <div className="relative">
                            <CameraPreview
                                ref={videoRef}
                                active={camera.status === 'active'}
                            />

                            {/* Virtual cursor overlay — screen-space position (not mirrored).
                                Represents the game cursor the user would control. */}
                            {engine.headTrackPosition && engine.status === 'running' && (
                                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                                    <div
                                        className="absolute size-5 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75"
                                        style={{
                                            left: `${engine.headTrackPosition.x * 100}%`,
                                            top: `${engine.headTrackPosition.y * 100}%`,
                                        }}
                                    >
                                        <div className="size-full rounded-full border-2 border-white bg-primary/60 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
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
                                    {(['yaw', 'pitch', 'roll'] as const).map((axis) => (
                                        <div key={axis}>
                                            <div className="text-[10px] uppercase text-muted-foreground">{axis}</div>
                                            <div className="font-mono text-sm tabular-nums">
                                                {(engine.headPose![axis] * 45).toFixed(1)}°
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {engine.headTrackPosition && (
                                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/30 pt-2 text-center">
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">Cursor X</div>
                                            <div className="font-mono text-sm tabular-nums">
                                                {(engine.headTrackPosition.x * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">Cursor Y</div>
                                            <div className="font-mono text-sm tabular-nums">
                                                {(engine.headTrackPosition.y * 100).toFixed(1)}%
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
                                    <div key={name} className="flex items-center gap-2">
                                        <span className="w-36 truncate text-[10px] text-muted-foreground">
                                            {name}
                                        </span>
                                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all duration-100',
                                                    value > 0.5 ? 'bg-green-500' : 'bg-primary/60',
                                                )}
                                                style={{ width: `${Math.min(100, value * 100)}%` }}
                                            />
                                        </div>
                                        <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                                            {value.toFixed(2)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right panel: performance + gesture log */}
                    <div className="space-y-4">
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
                                            <div className="text-[10px] uppercase text-muted-foreground">FPS</div>
                                            <div className="font-mono text-lg tabular-nums">{engine.performance.fps}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">Inference</div>
                                            <div className="font-mono text-lg tabular-nums">{engine.performance.inferenceMs}ms</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">Target</div>
                                            <div className="font-mono text-lg tabular-nums">{engine.performance.targetFps}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="py-2 text-center text-xs text-muted-foreground">
                                        Waiting for data...
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Baseline status */}
                        {engine.baseline && (
                            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                                <p className="text-xs text-green-600 dark:text-green-400">
                                    Neutral baseline captured at{' '}
                                    {new Date(engine.baseline.capturedAt).toLocaleTimeString()}
                                </p>
                            </div>
                        )}

                        {/* Gesture event log */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-medium">Gesture Log</h2>
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
                                            className="flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors animate-in fade-in slide-in-from-top-1"
                                        >
                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                {GESTURE_LABELS[entry.gesture] ?? entry.gesture}
                                            </Badge>
                                            <span className="font-mono text-muted-foreground">
                                                {entry.confidence.toFixed(2)} @ {new Date(entry.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
