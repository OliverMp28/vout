/**
 * Grabación guiada de Vision Lab (`lib/mediapipe/gesture-recording.ts`).
 *
 * `useGestureRecorder` lleva el guion y la grabación; Vision Lab pasa su
 * `onFrame` al motor de gestos. Al terminar el guion se descarga un JSON con
 * la pose, los blendshapes y los gestos de cada fotograma, nunca imágenes.
 */

import { CircleDot, Download, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GestureRecorder } from '@/lib/mediapipe/gesture-recording';
import type {
    RecorderProgress,
    RecordingMeta,
} from '@/lib/mediapipe/gesture-recording';
import type { AnalyzedFrame } from '@/lib/mediapipe/types';

/** Cada cuánto se refresca la instrucción y la cuenta atrás. */
const PROGRESS_INTERVAL_MS = 100;

export type GestureRecorderControls = {
    /** Pasarlo como `onFrame` al motor de gestos. */
    onFrame: (frame: AnalyzedFrame) => void;
    start: () => void;
    cancel: () => void;
    progress: RecorderProgress | null;
    lastDownload: { fileName: string; frames: number } | null;
};

export function useGestureRecorder(
    getMeta: () => RecordingMeta,
): GestureRecorderControls {
    const recorderRef = useRef<GestureRecorder | null>(null);
    const getMetaRef = useRef(getMeta);
    const [progress, setProgress] = useState<RecorderProgress | null>(null);
    const [lastDownload, setLastDownload] =
        useState<GestureRecorderControls['lastDownload']>(null);

    useEffect(() => {
        getMetaRef.current = getMeta;
    });

    const onFrame = useCallback((frame: AnalyzedFrame) => {
        recorderRef.current?.addFrame(frame);
    }, []);

    const start = useCallback(() => {
        const recorder = new GestureRecorder();
        const now = performance.now();

        recorder.start(now);
        recorderRef.current = recorder;
        setProgress(recorder.progress(now));
    }, []);

    const cancel = useCallback(() => {
        recorderRef.current = null;
        setProgress(null);
    }, []);

    const isRecording = progress !== null;

    useEffect(() => {
        if (!isRecording) {
            return;
        }

        const interval = setInterval(() => {
            const recorder = recorderRef.current;

            if (recorder === null) {
                return;
            }

            const current = recorder.progress(performance.now());

            if (!current.finished) {
                setProgress(current);

                return;
            }

            recorderRef.current = null;
            setProgress(null);

            const recordedAt = new Date();
            const fileName = `vout-gestures-${recordedAt.toISOString().replaceAll(':', '-').slice(0, 19)}.json`;

            downloadJson(
                fileName,
                recorder.toJSON(getMetaRef.current(), recordedAt),
            );
            setLastDownload({ fileName, frames: recorder.frameCount });
        }, PROGRESS_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isRecording]);

    return { onFrame, start, cancel, progress, lastDownload };
}

type GestureRecordingPanelProps = {
    recorder: GestureRecorderControls;
    /** Solo se puede grabar con el motor en marcha. */
    canRecord: boolean;
};

export function GestureRecordingPanel({
    recorder,
    canRecord,
}: GestureRecordingPanelProps) {
    const { progress, lastDownload } = recorder;
    const active = progress !== null && !progress.finished ? progress : null;

    return (
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-medium">
                    <CircleDot className="size-3.5 text-danger-text" />
                    Grabación guiada
                </h3>
                {active === null ? (
                    <Button
                        id="vision-recording-start"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={recorder.start}
                        disabled={!canRecord}
                    >
                        Empezar (~3 min)
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={recorder.cancel}
                    >
                        <Square className="size-3" />
                        Cancelar
                    </Button>
                )}
            </div>

            {active === null ? (
                <p className="text-xs text-muted-foreground">
                    Sigue las instrucciones y al final se descarga un fichero
                    con la pose de la cabeza, la intensidad de cada gesto y los
                    gestos detectados. Solo números, nunca imágenes. Sirve para
                    ajustar la detección con datos reales.
                </p>
            ) : (
                <div className="space-y-2" aria-live="polite">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                            Paso {active.index + 1}:{' '}
                            {active.phase === 'prepare'
                                ? 'prepárate…'
                                : '¡ahora!'}
                        </span>
                        <span className="tabular-nums">
                            {Math.ceil(active.remainingMs / 1000)} s
                        </span>
                    </div>
                    <p
                        className={
                            active.phase === 'prepare'
                                ? 'text-sm text-muted-foreground'
                                : 'text-sm font-semibold text-foreground'
                        }
                    >
                        {active.step.instruction}
                    </p>
                    <Progress value={active.overall * 100} />
                </div>
            )}

            {active === null && lastDownload !== null && (
                <p className="flex items-center gap-1.5 text-[11px] text-success-text">
                    <Download className="size-3" />
                    {lastDownload.fileName} ({lastDownload.frames} fotogramas)
                </p>
            )}
        </div>
    );
}

function downloadJson(fileName: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}
