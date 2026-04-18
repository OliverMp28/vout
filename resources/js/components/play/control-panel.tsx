/**
 * Panel lateral del reproductor de juego (Fase 3.5 — Sesión 3).
 *
 * El componente actúa como router condicional que renderiza uno de tres
 * sub-paneles según el contexto del usuario:
 *
 *  - `UnconfiguredPanel` → Sin configuración de gestos guardada.
 *    Muestra un CTA invitador hacia Ajustes; no expone controles inútiles.
 *
 *  - `IdlePanel` → Tiene config pero el motor no está corriendo.
 *    Muestra estado, CTA de activación y enlace a personalizar controles.
 *
 *  - `RunningPanel` → Motor activo.
 *    Panel completo: dispatch, sensibilidad, calibración, último gesto, FPS.
 *
 * Regla de UX: el control facial es ADITIVO, nunca restrictivo. Un usuario
 * que solo quiere jugar con teclado no ve sliders ni métricas de FPS.
 *
 * El componente es 100% controlado: todo el estado vive en `play/game.tsx`
 * vía `usePlayOrchestrator`. Esto evita drift entre la UI y el dispatcher.
 */

import { Link } from '@inertiajs/react';
import {
    ChevronDown,
    Crosshair,
    Gauge,
    Hand,
    Loader2,
    Play,
    RotateCcw,
    Settings2,
    Square,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/use-translation';
import type { HandshakeStatus } from '@/lib/iframe/types';
import type { HeadTrackingMode } from '@/lib/mediapipe/action-types';
import type { EngineStatus, GestureType } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';
import appearance from '@/routes/appearance';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

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

    onToggleEngine: () => void;
    onToggleDispatch: (enabled: boolean) => void;
    onSensitivityChange: (value: number) => void;
    onCalibrate: () => void;
};

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ENGINE_BADGE: Record<EngineStatus, { color: string; key: string }> = {
    idle: { color: 'bg-muted-foreground/40', key: 'play.engine.idle' },
    loading: { color: 'bg-yellow-500', key: 'play.engine.loading' },
    ready: { color: 'bg-yellow-500', key: 'play.engine.loading' },
    running: { color: 'bg-green-500', key: 'play.engine.running' },
    paused: { color: 'bg-orange-400', key: 'play.engine.paused' },
    error: { color: 'bg-red-500', key: 'play.engine.error' },
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
    const isRunning = engineStatus === 'running';
    const isLoading = engineStatus === 'loading';

    if (!hasGestureConfig) {
        return <UnconfiguredPanel />;
    }

    if (isRunning || isLoading) {
        return <RunningPanel {...props} />;
    }

    return <IdlePanel {...props} />;
}

// ---------------------------------------------------------------------------
// UnconfiguredPanel — usuario sin perfil de gestos
// ---------------------------------------------------------------------------

function UnconfiguredPanel() {
    const { t } = useTranslation();

    return (
        <div className="flex h-full flex-col items-center justify-center gap-5 p-1 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Hand className="size-7 text-primary" />
            </div>

            <div className="space-y-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                    {t('play.panel.unconfigured.title')}
                </h3>
                <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                    {t('play.panel.unconfigured.description')}
                </p>
            </div>

            <Button asChild variant="default" size="sm" className="gap-2">
                <Link href={appearance.edit.url()}>
                    <Settings2 className="size-4" />
                    {t('play.panel.unconfigured.cta')}
                </Link>
            </Button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// IdlePanel — configurado, motor detenido
// ---------------------------------------------------------------------------

function IdlePanel({
    engineStatus,
    onToggleEngine,
}: Pick<ControlPanelProps, 'engineStatus' | 'onToggleEngine'>) {
    const { t } = useTranslation();
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
                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-linear-to-b from-background/80 to-background/40 p-3.5 shadow-sm">
                    <StatusRow
                        label={t('play.panel.engine')}
                        color={engineBadge.color}
                        text={t(engineBadge.key)}
                    />
                </div>
            </section>

            {/* CTA de activación — hero con anillo primario */}
            <section className="space-y-2">
                <div className="rounded-xl bg-linear-to-b from-primary/40 to-primary/10 p-px shadow-lg shadow-primary/10">
                    <Button
                        id="play-engine-toggle"
                        onClick={onToggleEngine}
                        size="lg"
                        className="h-12 w-full gap-2 text-sm font-semibold shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <Play className="size-4 fill-current" />
                        {t('play.panel.start')}
                    </Button>
                </div>
            </section>

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
                    <Link href={appearance.edit.url()}>
                        <Settings2 className="size-4" />
                        {t('play.panel.configure_mappings')}
                    </Link>
                </Button>
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// RunningPanel — motor activo o cargando
// ---------------------------------------------------------------------------

function RunningPanel({
    engineStatus,
    handshakeStatus,
    dispatchEnabled,
    sensitivity,
    headTrackingMode,
    lastGesture,
    fps,
    onToggleEngine,
    onToggleDispatch,
    onSensitivityChange,
    onCalibrate,
}: ControlPanelProps) {
    const { t } = useTranslation();
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const engineBadge = ENGINE_BADGE[engineStatus];
    const isRunning = engineStatus === 'running';
    const isLoading = engineStatus === 'loading';
    const canCalibrate = isRunning;

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
                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-linear-to-b from-background/80 to-background/40 p-3.5 shadow-sm">
                    <StatusRow
                        label={t('play.panel.engine')}
                        color={engineBadge.color}
                        text={t(engineBadge.key)}
                        pulse={isRunning || isLoading}
                    />
                </div>
            </section>

            {/* ── Parar motor ──────────────────────────────────────────────── */}
            <section>
                <Button
                    id="play-engine-toggle"
                    onClick={onToggleEngine}
                    variant={isRunning ? 'destructive' : 'default'}
                    size="lg"
                    aria-pressed={isRunning}
                    className="h-12 w-full gap-2 text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                        disabled={
                            !isRunning || handshakeStatus !== 'authenticated'
                        }
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

            {/* ── Modo de cabeza + centrar cursor ──────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Crosshair className="size-3.5 text-primary/70" />
                        {t('play.panel.head_mode')}
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                        {t(HEAD_MODE_KEY[headTrackingMode])}
                    </Badge>
                </div>

                <Button
                    id="play-calibrate"
                    variant="secondary"
                    size="sm"
                    onClick={onCalibrate}
                    disabled={!canCalibrate}
                    className="w-full gap-2"
                >
                    <RotateCcw className="size-4" />
                    {t('play.panel.calibrate')}
                </Button>
            </section>

            <Separator />

            {/* ── Último gesto detectado ───────────────────────────────────── */}
            <section className="space-y-2">
                <SectionLabel>{t('play.panel.last_gesture')}</SectionLabel>
                <div
                    aria-live="polite"
                    className={cn(
                        'relative flex min-h-13 items-center justify-center overflow-hidden rounded-xl border px-3 py-3 text-center transition-all duration-300',
                        lastGesture
                            ? 'border-primary/40 bg-primary/8 shadow-inner shadow-primary/10'
                            : 'border-dashed border-border/60 bg-background/30',
                    )}
                >
                    {lastGesture ? (
                        <span
                            key={lastGesture}
                            className="animate-in font-mono text-sm font-medium tracking-wide text-primary zoom-in-95 fade-in"
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
                        className="group rounded-xl border border-border/60 bg-background/40 transition-colors open:bg-background/60 hover:bg-background/60"
                        onToggle={(e) =>
                            setAdvancedOpen(
                                (e.target as HTMLDetailsElement).open,
                            )
                        }
                    >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-muted-foreground transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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
                    <Link href={appearance.edit.url()}>
                        <Settings2 className="size-4" />
                        {t('play.panel.configure_mappings')}
                    </Link>
                </Button>
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Subcomponentes compartidos
// ---------------------------------------------------------------------------

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
            className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
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
