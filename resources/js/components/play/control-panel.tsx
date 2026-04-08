/**
 * Panel lateral del reproductor de juego.
 *
 * Expone los controles esenciales que el jugador puede tocar sin salir
 * de la página: arranque/parada del motor de visión, sensibilidad,
 * recalibración, y un acceso rápido al editor de mapeos. El panel es
 * intencionalmente compacto — la configuración profunda sigue viviendo
 * en `/settings/appearance` para no duplicar superficie.
 *
 * Patrones de UX seguidos:
 * - El componente es 100% controlado: todo el estado vive en la página
 *   `play/game.tsx`. Esto evita drift entre la UI y el dispatcher.
 * - Estado visible: badges y colores reflejan en qué fase está cada
 *   subsistema (handshake / motor) sin abrumar al usuario.
 * - Accesibilidad: cada control tiene `<Label htmlFor>` o `aria-label`,
 *   los grupos colapsables siguen el patrón Disclosure de Radix.
 *
 * El componente NO conoce el iframe ni el ActionDispatcher: es puro UI.
 */

import { Link } from '@inertiajs/react';
import { Crosshair, Gauge, Loader2, Play, RotateCcw, Settings2, Square } from 'lucide-react';

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

/**
 * Mapea EngineStatus a un par {color, key i18n} para el badge superior.
 * Mantiene la presentación de estados consistente con `GestureStatusIndicator`
 * pero sin reusar ese componente directamente — aquí queremos un layout
 * más rico (texto + acción).
 */
const ENGINE_BADGE: Record<EngineStatus, { color: string; key: string }> = {
    idle: { color: 'bg-muted-foreground/40', key: 'play.engine.idle' },
    loading: { color: 'bg-yellow-500', key: 'play.engine.loading' },
    ready: { color: 'bg-yellow-500', key: 'play.engine.loading' },
    running: { color: 'bg-green-500', key: 'play.engine.running' },
    paused: { color: 'bg-orange-400', key: 'play.engine.paused' },
    error: { color: 'bg-red-500', key: 'play.engine.error' },
};

const HANDSHAKE_BADGE: Record<HandshakeStatus, { color: string; key: string }> = {
    waiting: { color: 'bg-muted-foreground/40', key: 'play.handshake.waiting' },
    ready: { color: 'bg-yellow-500', key: 'play.handshake.ready' },
    authenticated: { color: 'bg-green-500', key: 'play.handshake.authenticated' },
    error: { color: 'bg-red-500', key: 'play.handshake.error' },
};

const HEAD_MODE_KEY: Record<HeadTrackingMode, string> = {
    cursor: 'play.head_mode.cursor',
    gesture: 'play.head_mode.gesture',
    disabled: 'play.head_mode.disabled',
};

export function ControlPanel({
    engineStatus,
    handshakeStatus,
    hasGestureConfig,
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

    const engineBadge = ENGINE_BADGE[engineStatus];
    const handshakeBadge = HANDSHAKE_BADGE[handshakeStatus];

    const isRunning = engineStatus === 'running';
    const isLoading = engineStatus === 'loading';
    const canCalibrate = isRunning;
    const canActivate = hasGestureConfig && engineStatus !== 'loading';

    return (
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-1">
            {/* ── Estado de los subsistemas ──────────────────────────────────── */}
            <section aria-labelledby="play-status-heading" className="space-y-3">
                <SectionLabel id="play-status-heading">{t('play.panel.status')}</SectionLabel>

                {/* Card con borde sutil + leve gradiente vertical para dar profundidad sin pesar */}
                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-linear-to-b from-background/80 to-background/40 p-3.5 shadow-sm">
                    <div className="space-y-2.5">
                        <StatusRow
                            label={t('play.panel.handshake')}
                            color={handshakeBadge.color}
                            text={t(handshakeBadge.key)}
                        />
                        <StatusRow
                            label={t('play.panel.engine')}
                            color={engineBadge.color}
                            text={t(engineBadge.key)}
                            pulse={isRunning || isLoading}
                        />
                        {fps !== null && isRunning && (
                            <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-2.5">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Gauge className="size-3.5" />
                                    {t('play.panel.fps')}
                                </span>
                                <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                                    {fps}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Acción principal: arrancar / parar el motor ────────────────── */}
            {/* Hero CTA: cuando idle está envuelto en un anillo primario sutil */}
            {/* para destacar visualmente sobre el resto de controles. */}
            <section className="space-y-2">
                <div
                    className={cn(
                        'rounded-xl p-px transition-all duration-300',
                        !isRunning && canActivate && 'bg-linear-to-b from-primary/40 to-primary/10 shadow-lg shadow-primary/10',
                    )}
                >
                    <Button
                        id="play-engine-toggle"
                        onClick={onToggleEngine}
                        disabled={!canActivate}
                        variant={isRunning ? 'destructive' : 'default'}
                        size="lg"
                        className={cn(
                            'h-12 w-full gap-2 text-sm font-semibold',
                            !isRunning && 'shadow-md shadow-primary/20',
                        )}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                {t('play.engine.loading')}
                            </>
                        ) : isRunning ? (
                            <>
                                <Square className="size-4 fill-current" />
                                {t('play.panel.stop')}
                            </>
                        ) : (
                            <>
                                <Play className="size-4 fill-current" />
                                {t('play.panel.start')}
                            </>
                        )}
                    </Button>
                </div>

                {!hasGestureConfig && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        {t('play.panel.no_config_hint')}
                    </p>
                )}
            </section>

            <Separator />

            {/* ── Toggle dispatch (envío real al juego) ──────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <Label htmlFor="play-dispatch-toggle" className="text-sm font-medium">
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
                        disabled={!isRunning || handshakeStatus !== 'authenticated'}
                        aria-label={t('play.panel.dispatch')}
                    />
                </div>
            </section>

            {/* ── Sensibilidad ───────────────────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="play-sensitivity" className="text-sm font-medium">
                        {t('play.panel.sensitivity')}
                    </Label>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
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

            {/* ── Modo de head tracking + recalibrar ─────────────────────────── */}
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

            {/* ── Último gesto detectado (feedback inmediato) ────────────────── */}
            {/* Monitor en vivo: cuando llega un gesto, la card se ilumina con */}
            {/* un acento primario y el texto en mono — feedback satisfactorio. */}
            <section className="space-y-2">
                <SectionLabel>{t('play.panel.last_gesture')}</SectionLabel>
                <div
                    aria-live="polite"
                    className={cn(
                        'relative flex min-h-[3.25rem] items-center justify-center overflow-hidden rounded-xl border px-3 py-3 text-center transition-all duration-300',
                        lastGesture
                            ? 'border-primary/40 bg-primary/8 shadow-inner shadow-primary/10'
                            : 'border-dashed border-border/60 bg-background/30',
                    )}
                >
                    {lastGesture ? (
                        <span
                            key={lastGesture}
                            className="animate-in fade-in zoom-in-95 font-mono text-sm font-medium tracking-wide text-primary"
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

            {/* ── Acceso al editor completo de mapeos ────────────────────────── */}
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

function SectionLabel({ id, children }: { id?: string; children: React.ReactNode }) {
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
                    <span className={cn('relative inline-flex size-2 rounded-full', color)} />
                </span>
                <span className="font-medium text-foreground">{text}</span>
            </span>
        </div>
    );
}

