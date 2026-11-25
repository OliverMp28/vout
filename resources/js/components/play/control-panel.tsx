/**
 * Panel de control facial del reproductor de juego.
 *
 * Solo existe en juegos que reciben los controles de Vout, y en escritorio
 * va en una columna que el usuario abre o cierra (`play/game.tsx`). Elige
 * uno de tres sub-paneles:
 *
 *  - `TrialPanel` → Sin perfil de gestos guardado. Ofrece probarlo ya
 *    ("Probar ahora"), sin configurar ni guardar nada, con los controles que
 *    sugiere el juego o los de plataformas.
 *
 *  - `IdlePanel` → Tiene perfil pero el motor no está en marcha.
 *    Estado, botón de activar y enlace a personalizar controles.
 *
 *  - `RunningPanel` → Motor en marcha, cargando o en pausa (pestaña oculta).
 *    Panel completo: dispatch, sensibilidad, calibración, último gesto, FPS.
 *
 * Regla de UX: el control facial es ADITIVO, nunca restrictivo. Un usuario
 * que solo quiere jugar con teclado no ve sliders ni métricas de FPS. La
 * vista de la cámara también es opcional y está apagada por defecto.
 *
 * El componente es 100% controlado: todo el estado vive en `play/game.tsx`
 * vía `usePlayOrchestrator`. Esto evita drift entre la UI y el dispatcher.
 */

import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    ChevronDown,
    Crosshair,
    Gauge,
    Hand,
    Info,
    Loader2,
    Play,
    RotateCcw,
    Settings2,
    Square,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { GamePresetChoice } from '@/components/play/game-preset-choice';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/use-translation';
import type { HandshakeStatus } from '@/lib/iframe/types';
import type { HeadTrackingMode } from '@/lib/mediapipe/action-types';
import type { CameraDevice } from '@/lib/mediapipe/camera-devices';
import type {
    CalibrationState,
    EngineStatus,
    GestureType,
} from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';
import appearance from '@/routes/appearance';
import { show as legalShow } from '@/routes/legal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Aviso sobre la cámara, ya traducido: un fallo, un cambio automático o una cámara lenta. */
export type CameraNotice = {
    tone: 'error' | 'info';
    /** Qué aviso es (`denied`, `skipped`, `low_fps`…). */
    code: string;
    text: string;
};

type ControlPanelProps = {
    /** Estado actual del motor de visión. */
    engineStatus: EngineStatus;
    /** Estado del handshake con el iframe del juego. */
    handshakeStatus: HandshakeStatus;
    /** True si el usuario tiene una configuración de gestos guardada. */
    hasGestureConfig: boolean;
    /** Si el usuario tiene activado el dispatch (envío de acciones al juego). */
    dispatchEnabled: boolean;
    /** Sensibilidad actual del motor (1-10). */
    sensitivity: number;
    /** Modo de head tracking en uso. */
    headTrackingMode: HeadTrackingMode;
    /** Último gesto detectado — produce un highlight breve cuando cambia. */
    lastGesture: GestureType | null;
    /** Métrica de FPS del motor (puede ser null si aún no llegó). */
    fps: number | null;
    /** Cámaras disponibles. El selector solo aparece si hay más de una. */
    cameras: CameraDevice[];
    /** Cámara en uso por el control facial, o null si no hay ninguna abierta. */
    activeCameraId: string | null;
    /** True mientras se abre una cámara y se espera su primera imagen. */
    cameraBusy: boolean;
    /** Qué pasó con la cámara, si hay algo que contar al usuario. */
    cameraNotice: CameraNotice | null;

    onSelectCamera: (deviceId: string) => void;
    onToggleEngine: () => void;
    /**
     * El usuario se acerca a "Activar" (ratón encima o foco): se puede ir
     * preparando el motor.
     */
    onEngineIntent?: () => void;
    onToggleDispatch: (enabled: boolean) => void;
    onSensitivityChange: (value: number) => void;
    /** Recentra el cursor de la cabeza (no toca la calibración). */
    onRecenter: () => void;
    /** Vuelve a tomar la cara neutra. */
    onCalibrate: () => void;
    /** Estado de la calibración de la cara neutra. */
    calibration: CalibrationState;
    /** Si se muestra la vista de la cámara mientras el motor funciona. */
    previewEnabled: boolean;
    onTogglePreview: (enabled: boolean) => void;
    /** La vista de la cámara, si se ve en el panel (si no, va sobre el juego). */
    preview?: ReactNode;
    /** Preset que sugiere el juego, o null. */
    suggestedPreset: string | null;
    /** Preset del juego en uso, o null si se usan los controles propios. */
    activeGamePreset: string | null;
    /** Hay que preguntar qué controles se usan en este juego. */
    askPresetChoice: boolean;
    onChoosePreset: (choice: string) => void;
    /**
     * Juega un invitado: los enlaces a Ajustes pasan a "Entrar" (vuelve al
     * juego tras el login), porque sin cuenta no hay controles que guardar.
     */
    signInHref: string | null;
};

/** A dónde lleva "guardar tus controles": Ajustes, o entrar si no hay cuenta. */
function useSaveControlsLink(signInHref: string | null): {
    href: string;
    /** Botón corto. */
    label: string;
    /** Dentro de una frase ("Para guardar los tuyos: …"). */
    inlineLabel: string;
    /** Botón del pie del panel. */
    longLabel: string;
} {
    const { t } = useTranslation();

    return signInHref === null
        ? {
              href: appearance.edit.url(),
              label: t('play.panel.unconfigured.cta'),
              inlineLabel: t('play.panel.unconfigured.cta'),
              longLabel: t('play.panel.configure_mappings'),
          }
        : {
              href: signInHref,
              label: t('play.panel.guest.cta'),
              inlineLabel: t('play.panel.guest.inline'),
              longLabel: t('play.panel.guest.cta'),
          };
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ENGINE_BADGE: Record<EngineStatus, { color: string; key: string }> = {
    idle: { color: 'bg-led-off', key: 'play.engine.idle' },
    loading: { color: 'bg-warning', key: 'play.engine.loading' },
    ready: { color: 'bg-warning', key: 'play.engine.loading' },
    running: { color: 'bg-success', key: 'play.engine.running' },
    paused: { color: 'bg-warning', key: 'play.engine.paused' },
    error: { color: 'bg-danger', key: 'play.engine.error' },
};

const HEAD_MODE_KEY: Record<HeadTrackingMode, string> = {
    cursor: 'play.head_mode.cursor',
    gesture: 'play.head_mode.gesture',
    disabled: 'play.head_mode.disabled',
};

// ---------------------------------------------------------------------------
// Router principal
// ---------------------------------------------------------------------------

export function ControlPanel(props: ControlPanelProps) {
    const { hasGestureConfig, engineStatus } = props;

    if (
        engineStatus === 'running' ||
        engineStatus === 'loading' ||
        engineStatus === 'paused'
    ) {
        return <RunningPanel {...props} />;
    }

    if (!hasGestureConfig) {
        return <TrialPanel {...props} />;
    }

    return <IdlePanel {...props} />;
}

// ---------------------------------------------------------------------------
// TrialPanel — sin perfil de gestos: probarlo ya, sin configurar nada
// ---------------------------------------------------------------------------

function TrialPanel({
    cameraBusy,
    cameraNotice,
    onToggleEngine,
    onEngineIntent,
    signInHref,
}: Pick<
    ControlPanelProps,
    | 'cameraBusy'
    | 'cameraNotice'
    | 'onToggleEngine'
    | 'onEngineIntent'
    | 'signInHref'
>) {
    const { t } = useTranslation();
    const saveLink = useSaveControlsLink(signInHref);

    return (
        <div className="flex h-full flex-col items-center justify-center gap-5 p-1 text-center">
            <div className="flex size-14 items-center justify-center rounded-surface border bg-surface-sunken">
                <Hand className="size-7 text-muted-foreground" />
            </div>

            <div className="space-y-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                    {t('play.panel.unconfigured.title')}
                </h3>
                <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                    {t('play.panel.unconfigured.description')}
                </p>
            </div>

            <div className="w-full space-y-2">
                <Button
                    type="button"
                    id="play-engine-toggle"
                    onClick={onToggleEngine}
                    onPointerEnter={onEngineIntent}
                    onFocus={onEngineIntent}
                    disabled={cameraBusy}
                    aria-busy={cameraBusy}
                    className="w-full gap-2"
                >
                    {cameraBusy ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            {t('play.camera.connecting')}
                        </>
                    ) : (
                        <>
                            <Play className="size-4 fill-current" />
                            {t('play.panel.unconfigured.try')}
                        </>
                    )}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                    {t('play.panel.unconfigured.privacy')}{' '}
                    <Link
                        href={legalShow('privacidad').url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-signal-strong"
                    >
                        {t('play.panel.unconfigured.privacy_link')}
                    </Link>
                </p>
                <CameraNoticeAlert notice={cameraNotice} />
            </div>

            <Button asChild variant="ghost" size="sm" className="gap-2">
                <Link href={saveLink.href}>
                    <Settings2 className="size-4" />
                    {saveLink.label}
                </Link>
            </Button>
        </div>
    );
}

/** Los controles del juego, si sugiere unos (solo con perfil propio). */
function PresetRow({
    hasGestureConfig,
    suggestedPreset,
    activeGamePreset,
    askPresetChoice,
    onChoosePreset,
}: Pick<
    ControlPanelProps,
    | 'hasGestureConfig'
    | 'suggestedPreset'
    | 'activeGamePreset'
    | 'askPresetChoice'
    | 'onChoosePreset'
>) {
    if (suggestedPreset === null || !hasGestureConfig) {
        return null;
    }

    return (
        <GamePresetChoice
            suggested={suggestedPreset}
            active={activeGamePreset}
            ask={askPresetChoice}
            onChoose={onChoosePreset}
        />
    );
}

// ---------------------------------------------------------------------------
// IdlePanel — configurado, motor detenido
// ---------------------------------------------------------------------------

function IdlePanel(props: ControlPanelProps) {
    const {
        engineStatus,
        cameraBusy,
        cameraNotice,
        onToggleEngine,
        onEngineIntent,
    } = props;
    const { t } = useTranslation();
    const saveLink = useSaveControlsLink(props.signInHref);
    const engineBadge = ENGINE_BADGE[engineStatus];

    return (
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-1">
            {/* Estado */}
            <section
                aria-labelledby="play-status-heading"
                className="space-y-3"
            >
                <SectionLabel id="play-status-heading">
                    {t('play.panel.status')}
                </SectionLabel>
                <div className="relative overflow-hidden rounded-control border bg-background p-3.5">
                    <StatusRow
                        label={t('play.panel.engine')}
                        color={engineBadge.color}
                        text={t(engineBadge.key)}
                    />
                </div>
            </section>

            {/* CTA de activación — hero con anillo primario */}
            <section className="space-y-2">
                <div>
                    <Button
                        type="button"
                        id="play-engine-toggle"
                        onClick={onToggleEngine}
                        onPointerEnter={onEngineIntent}
                        onFocus={onEngineIntent}
                        size="lg"
                        disabled={cameraBusy}
                        aria-busy={cameraBusy}
                        variant="play"
                        className="h-12 w-full gap-2 text-sm font-bold"
                    >
                        {cameraBusy ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                {t('play.camera.connecting')}
                            </>
                        ) : (
                            <>
                                <Play className="size-4 fill-current" />
                                {t('play.panel.start')}
                            </>
                        )}
                    </Button>
                </div>
                <CameraNoticeAlert notice={cameraNotice} />
            </section>

            <PresetRow {...props} />

            <Separator />

            {/* Enlace a personalizar controles */}
            <section className="mt-auto pt-2">
                <Button
                    asChild
                    id="play-configure-mappings"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                >
                    <Link href={saveLink.href}>
                        <Settings2 className="size-4" />
                        {saveLink.longLabel}
                    </Link>
                </Button>
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// RunningPanel — motor activo o cargando
// ---------------------------------------------------------------------------

function RunningPanel(props: ControlPanelProps) {
    const {
        engineStatus,
        hasGestureConfig,
        handshakeStatus,
        dispatchEnabled,
        sensitivity,
        headTrackingMode,
        lastGesture,
        fps,
        cameras,
        activeCameraId,
        cameraBusy,
        cameraNotice,
        onSelectCamera,
        onToggleEngine,
        onToggleDispatch,
        onSensitivityChange,
        onRecenter,
        onCalibrate,
        calibration,
        previewEnabled,
        onTogglePreview,
        preview,
        signInHref,
    } = props;
    const { t } = useTranslation();
    const saveLink = useSaveControlsLink(signInHref);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const engineBadge = ENGINE_BADGE[engineStatus];
    const isRunning = engineStatus === 'running';
    const isLoading = engineStatus === 'loading';
    const isPaused = engineStatus === 'paused';
    const isCalibrating = calibration.status === 'calibrating';

    return (
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-1">
            {/* ── Estado del motor ─────────────────────────────────────────── */}
            <section
                aria-labelledby="play-status-heading"
                className="space-y-3"
            >
                <SectionLabel id="play-status-heading">
                    {t('play.panel.status')}
                </SectionLabel>
                <div className="relative overflow-hidden rounded-control border bg-background p-3.5">
                    <StatusRow
                        label={t('play.panel.engine')}
                        color={engineBadge.color}
                        text={t(engineBadge.key)}
                        pulse={isRunning || isLoading}
                    />
                </div>
            </section>

            {/* Prueba sin perfil: se dice y se ofrece guardarlo */}
            {!hasGestureConfig && (
                <Alert className="px-3 py-2.5" data-play-trial>
                    <Info />
                    <AlertDescription className="text-xs">
                        {t('play.panel.trial_notice')}{' '}
                        <Link
                            href={saveLink.href}
                            className="font-semibold text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-signal-strong"
                        >
                            {saveLink.inlineLabel}
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            {/* ── Parar motor ──────────────────────────────────────────────── */}
            <section>
                <Button
                    type="button"
                    id="play-engine-toggle"
                    onClick={onToggleEngine}
                    variant={isRunning || isPaused ? 'destructive' : 'default'}
                    size="lg"
                    aria-pressed={isRunning || isPaused}
                    className="h-12 w-full gap-2 text-sm font-bold"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            {t('play.engine.loading')}
                        </>
                    ) : (
                        <>
                            <Square className="size-4 fill-current" />
                            {t('play.panel.stop')}
                        </>
                    )}
                </Button>
            </section>

            {/* ── Vista de la cámara (opcional) ────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <Label
                            htmlFor="play-preview-toggle"
                            className="text-sm font-medium"
                        >
                            {t('play.panel.preview')}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                            {t('play.panel.preview_hint')}
                        </span>
                    </div>
                    <Switch
                        id="play-preview-toggle"
                        checked={previewEnabled}
                        onCheckedChange={onTogglePreview}
                        aria-label={t('play.panel.preview')}
                    />
                </div>
                {previewEnabled && preview}
            </section>

            <PresetRow {...props} />

            <Separator />

            {/* ── Toggle dispatch ──────────────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <Label
                            htmlFor="play-dispatch-toggle"
                            className="text-sm font-medium"
                        >
                            {t('play.panel.dispatch')}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                            {t('play.panel.dispatch_hint')}
                        </span>
                    </div>
                    <Switch
                        id="play-dispatch-toggle"
                        checked={dispatchEnabled}
                        onCheckedChange={onToggleDispatch}
                        disabled={!isRunning || handshakeStatus !== 'connected'}
                        aria-label={t('play.panel.dispatch')}
                    />
                </div>
            </section>

            {/* ── Sensibilidad ─────────────────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label
                        htmlFor="play-sensitivity"
                        className="text-sm font-medium"
                    >
                        {t('play.panel.sensitivity')}
                    </Label>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {sensitivity}
                    </span>
                </div>
                <Slider
                    id="play-sensitivity"
                    value={[sensitivity]}
                    onValueChange={([v]) => onSensitivityChange(v)}
                    min={1}
                    max={10}
                    step={1}
                    aria-label={t('play.panel.sensitivity')}
                />
            </section>

            {/* ── Cámara ───────────────────────────────────────────────────── */}
            {/* Solo con más de una: la elección automática puede no acertar   */}
            {/* (teléfono enlazado, cámara virtual) y el usuario debe poder     */}
            {/* corregirla sin salir del juego.                                 */}
            {(cameras.length > 1 || cameraNotice !== null) && (
                <section className="space-y-2">
                    {cameras.length > 1 && (
                        <>
                            <Label
                                htmlFor="play-camera"
                                className="flex items-center gap-2 text-sm font-medium"
                            >
                                <Camera className="size-4 text-muted-foreground" />
                                {t('play.panel.camera')}
                            </Label>
                            <NativeSelect
                                id="play-camera"
                                size="sm"
                                value={activeCameraId ?? ''}
                                disabled={cameraBusy}
                                onChange={(event) =>
                                    onSelectCamera(event.target.value)
                                }
                                options={cameras.map((camera) => ({
                                    value: camera.deviceId,
                                    label: camera.label,
                                }))}
                                aria-describedby="play-camera-hint"
                            />
                            <p
                                id="play-camera-hint"
                                className="text-xs text-muted-foreground"
                            >
                                {cameraBusy
                                    ? t('play.camera.connecting')
                                    : t('play.panel.camera_hint')}
                            </p>
                        </>
                    )}
                    <CameraNoticeAlert notice={cameraNotice} />
                </section>
            )}

            {/* ── Modo de cabeza + centrar cursor ──────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between gap-2 rounded-control border bg-background px-3 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Crosshair className="size-3.5 text-muted-foreground" />
                        {t('play.panel.head_mode')}
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                        {t(HEAD_MODE_KEY[headTrackingMode])}
                    </Badge>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {headTrackingMode !== 'disabled' && (
                        <Button
                            id="play-recenter"
                            variant="secondary"
                            size="sm"
                            onClick={onRecenter}
                            disabled={!isRunning}
                            className="w-full gap-2"
                        >
                            <Crosshair className="size-4" />
                            {t('play.panel.recenter')}
                        </Button>
                    )}
                    <Button
                        id="play-calibrate"
                        variant="secondary"
                        size="sm"
                        onClick={onCalibrate}
                        disabled={!isRunning || isCalibrating}
                        aria-busy={isCalibrating}
                        className="w-full gap-2"
                    >
                        {isCalibrating ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <RotateCcw className="size-4" />
                        )}
                        {t('play.panel.calibrate')}
                    </Button>
                </div>

                <CalibrationStatus calibration={calibration} />
            </section>

            <Separator />

            {/* ── Último gesto detectado ───────────────────────────────────── */}
            <section className="space-y-2">
                <SectionLabel>{t('play.panel.last_gesture')}</SectionLabel>
                <div
                    aria-live="polite"
                    className={cn(
                        'relative flex min-h-13 items-center justify-center overflow-hidden rounded-control border px-3 py-3 text-center transition-[background-color,border-color] duration-200',
                        lastGesture
                            ? 'border-signal-edge bg-signal-soft'
                            : 'border-dashed border-border/60 bg-background/30',
                    )}
                >
                    {lastGesture ? (
                        <span
                            key={lastGesture}
                            className="animate-in font-mono text-sm font-semibold tracking-wide text-foreground zoom-in-95 fade-in"
                        >
                            {lastGesture}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground/80">
                            {t('play.panel.no_gesture')}
                        </span>
                    )}
                </div>
            </section>

            {/* ── Bloque "Avanzado" colapsable ─────────────────────────────── */}
            {isRunning && fps !== null && (
                <section className="space-y-2">
                    <details
                        className="group rounded-control border bg-background transition-colors open:bg-surface-2 hover:bg-background/60"
                        onToggle={(e) =>
                            setAdvancedOpen(
                                (e.target as HTMLDetailsElement).open,
                            )
                        }
                    >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-control px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                            <span className="flex items-center gap-1.5">
                                <Gauge className="size-3.5" />
                                {t('play.panel.advanced')}
                            </span>
                            <ChevronDown
                                className={cn(
                                    'size-3.5 transition-transform duration-200',
                                    advancedOpen && 'rotate-180',
                                )}
                            />
                        </summary>
                        <div className="border-t border-border/50 px-3 py-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                    {t('play.panel.fps')}
                                </span>
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                    {fps}
                                </span>
                            </div>
                        </div>
                    </details>
                </section>
            )}

            {/* ── Personalizar controles ───────────────────────────────────── */}
            <section className="mt-auto pt-2">
                <Button
                    asChild
                    id="play-configure-mappings"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                >
                    <Link href={saveLink.href}>
                        <Settings2 className="size-4" />
                        {saveLink.longLabel}
                    </Link>
                </Button>
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Subcomponentes compartidos
// ---------------------------------------------------------------------------

/**
 * Aviso sobre la cámara dentro del panel. Un problema con la cámara no
 * impide jugar con teclado, así que se explica aquí y no tapando el juego.
 */
/**
 * Qué pasa con la calibración de la cara neutra. Mientras calibra, pide mirar
 * de frente con la cara relajada; si falla, explica por qué. Calibrada no
 * dice nada: es el estado normal.
 */
function CalibrationStatus({ calibration }: { calibration: CalibrationState }) {
    const { t } = useTranslation();

    if (calibration.status === 'calibrating') {
        return (
            <p
                role="status"
                data-calibration="calibrating"
                className="text-xs text-muted-foreground"
            >
                {t('play.calibration.calibrating')}
            </p>
        );
    }

    if (calibration.status === 'failed') {
        return (
            <Alert
                className="px-3 py-2.5"
                data-calibration="failed"
                data-calibration-reason={calibration.reason}
            >
                <Info />
                <AlertDescription className="text-xs">
                    {t(`play.calibration.failed.${calibration.reason}`)}
                </AlertDescription>
            </Alert>
        );
    }

    return null;
}

function CameraNoticeAlert({ notice }: { notice: CameraNotice | null }) {
    if (notice === null) {
        return null;
    }

    const isError = notice.tone === 'error';

    return (
        <Alert
            variant={isError ? 'destructive' : 'default'}
            className="px-3 py-2.5"
            data-camera-notice={notice.code}
        >
            {isError ? <AlertTriangle /> : <Info />}
            <AlertDescription className="text-xs">
                {notice.text}
            </AlertDescription>
        </Alert>
    );
}

function SectionLabel({
    id,
    children,
}: {
    id?: string;
    children: React.ReactNode;
}) {
    return (
        <h3
            id={id}
            className="font-pixel-label text-base leading-none text-muted-foreground"
        >
            {children}
        </h3>
    );
}

function StatusRow({
    label,
    color,
    text,
    pulse = false,
}: {
    label: string;
    color: string;
    text: string;
    pulse?: boolean;
}) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">{label}</span>
            <span className="flex items-center gap-2">
                <span className="relative flex size-2">
                    {pulse && (
                        <span
                            className={cn(
                                'absolute inline-flex size-full animate-ping rounded-full opacity-60',
                                color,
                            )}
                        />
                    )}
                    <span
                        className={cn(
                            'relative inline-flex size-2 rounded-full',
                            color,
                        )}
                    />
                </span>
                <span className="font-medium text-foreground">{text}</span>
            </span>
        </div>
    );
}
