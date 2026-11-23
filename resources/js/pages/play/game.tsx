/**
 * Página del reproductor de juegos embebidos (Fase 3.3).
 *
 * Este componente es un render puro: toda la lógica de orquestación,
 * estado y efectos vive en `usePlayOrchestrator`.
 *
 * Layout:
 *  - Desktop ≥ lg: iframe a la izquierda, panel lateral fijo a la derecha.
 *  - Tablet/móvil: iframe full-width, panel en Sheet accesible desde la cabecera.
 *
 * Reglas inamovibles:
 *  - El access token NUNCA aparece en URL — solo viaja por postMessage.
 *  - `targetOrigin` de postMessage siempre es el origen validado (jamás '*').
 *  - Teclas retenidas se liberan al perder foco (visibilitychange + blur).
 */

import { Head, usePage } from '@inertiajs/react';
import { Camera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ControlPanel } from '@/components/play/control-panel';
import type { CameraNotice } from '@/components/play/control-panel';
import { CursorOverlay } from '@/components/play/cursor-overlay';
import type { CursorOverlayHandle } from '@/components/play/cursor-overlay';
import { EngineOverlay } from '@/components/play/engine-overlay';
import { NowPlayingHeader } from '@/components/play/now-playing-header';
import { PresetSuggestionBanner } from '@/components/play/preset-suggestion-banner';
import { FaceMeshView } from '@/components/vision/face-mesh-view';
import type { GameSessionPayload } from '@/hooks/use-game-session';
import { useWarmEngineState } from '@/hooks/use-gesture-engine';
import { useMascotContext } from '@/hooks/use-mascot-context';
import { usePlayOrchestrator } from '@/hooks/use-play-orchestrator';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import { describeDiagnostics } from '@/lib/mediapipe/diagnostics';
import {
    getShowCameraInGame,
    setShowCameraInGame,
} from '@/lib/mediapipe/preview-preference';
import type { TelemetrySnapshot } from '@/lib/mediapipe/telemetry';
import type { GestureConfigData } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';
import type { Auth } from '@/types/auth';

// ---------------------------------------------------------------------------
// Tipos de props recibidas desde Inertia (PlayController)
// ---------------------------------------------------------------------------

type PlayGameProps = {
    game: {
        name: string;
        slug: string;
        description: string | null;
        cover_image: string | null;
        embed_url: string;
        effective_origins: string[];
    };
    activeGestureConfig: GestureConfigData | null;
    session: GameSessionPayload;
};

/** Lo que muestra el overlay de telemetría (Ctrl+M). */
type TelemetryView = {
    stats: TelemetrySnapshot;
    info: [string, string][];
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function PlayGame({
    game,
    activeGestureConfig,
    session,
}: PlayGameProps) {
    const { t } = useTranslation();
    const { auth } = usePage<{ auth: Auth }>().props;

    // ── Refs DOM ───────────────────────────────────────────────────────────
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cursorRef = useRef<CursorOverlayHandle | null>(null);

    // Solo lo que NO pertenece al orquestador (estado de layout puro).
    const [panelOpen, setPanelOpen] = useState(false);
    const [showTelemetry, setShowTelemetry] = useState(false);
    const [telemetryView, setTelemetryView] = useState<TelemetryView | null>(
        null,
    );
    // Ver la cámara mientras se juega: apagado por defecto, se recuerda
    // mientras dure la pestaña.
    const [previewEnabled, setPreviewEnabled] = useState(getShowCameraInGame);
    const handleTogglePreview = useCallback((enabled: boolean) => {
        setPreviewEnabled(enabled);
        setShowCameraInGame(enabled);
    }, []);

    // ── Hotkey para telemetría (Ctrl+M) ────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                setShowTelemetry((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ── Callback imperativo para el cursor (evita setState a 30fps) ────────
    const handleCursorMove = useCallback(
        (x: number, y: number, visible: boolean) => {
            cursorRef.current?.setPosition(x, y, visible);
        },
        [],
    );

    // ── Orquestador ────────────────────────────────────────────────────────
    const {
        sensitivity,
        headTrackingMode,
        dispatchEnabled,
        lastGesture,
        hasGestureConfig,
        presetSuggestion,
        errorMessage,
        engine,
        handshake,
        camera,
        handleToggleEngine,
        handleEngineIntent,
        handleRetryGame,
        handleSelectCamera,
        handleAcceptPreset,
        recenterCursor,
        setDispatchEnabled,
        setSensitivity,
        dismissPresetSuggestion,
    } = usePlayOrchestrator({
        game,
        activeGestureConfig,
        session,
        user: auth.user,
        iframeRef,
        videoRef,
        onCursorMove: handleCursorMove,
    });

    // Motor cargado (precarga): solo informativo, para depurar y para los
    // tests de navegador.
    const warmEngineState = useWarmEngineState();

    // ── Loop de telemetría in-game ─────────────────────────────────────────
    const engineTelemetry = engine.telemetry;
    const getEngineDiagnostics = engine.getDiagnostics;
    useEffect(() => {
        if (!showTelemetry || engine.status !== 'running') return;
        const interval = setInterval(() => {
            setTelemetryView({
                stats: engineTelemetry.snapshot(),
                info: describeDiagnostics(getEngineDiagnostics()),
            });
        }, 500);
        return () => clearInterval(interval);
    }, [showTelemetry, engine.status, engineTelemetry, getEngineDiagnostics]);

    // ── Mensajes contextuales para Vou (S7) ────────────────────────────────
    // Mientras el motor de gestos está activo, sugerimos una celebración
    // motivadora; si el motor está apagado y hay perfil configurado,
    // invitamos a activarlo.
    useMascotContext([
        {
            id: 'play.game.running',
            priority: 20,
            when: engine.status === 'running',
            text: t('mascot.context.play.game'),
        },
        {
            id: 'play.game.engine_off',
            priority: 10,
            auto: true,
            when: engine.status !== 'running' && hasGestureConfig,
            text: t('mascot.context.play.engine_off'),
        },
    ]);

    // ── Aviso de cámara ────────────────────────────────────────────────────
    // Un problema con la cámara no bloquea el juego (se puede jugar con
    // teclado), así que se explica en el panel y no en un overlay. Por
    // prioridad: un fallo, una cámara descartada y, por último, una cámara
    // tan lenta (suele ser falta de luz) que retrasa los gestos.
    const slowCameraFps = engine.performance?.cameraSlow
        ? engine.performance.cameraFps
        : null;
    const cameraNotice: CameraNotice | null = camera.issue
        ? {
              tone: 'error',
              code: camera.issue,
              text: t(`play.camera.${camera.issue}`),
          }
        : camera.skippedCamera
          ? {
                tone: 'info',
                code: 'skipped',
                text: t('play.camera.skipped', {
                    camera: camera.skippedCamera,
                }),
            }
          : slowCameraFps !== null
            ? {
                  tone: 'info',
                  code: 'low_fps',
                  text: t('play.camera.low_fps', { fps: slowCameraFps }),
              }
            : null;

    // ── Panel — el mismo contenido se usa en desktop y en el Sheet móvil ──
    const panelContent = (
        <ControlPanel
            engineStatus={engine.status}
            handshakeStatus={handshake.status}
            hasGestureConfig={hasGestureConfig}
            dispatchEnabled={dispatchEnabled}
            sensitivity={sensitivity}
            headTrackingMode={headTrackingMode}
            lastGesture={lastGesture}
            fps={engine.performance?.fps ?? null}
            cameras={camera.cameras}
            activeCameraId={camera.activeCameraId}
            cameraBusy={camera.busy}
            cameraNotice={cameraNotice}
            onSelectCamera={handleSelectCamera}
            onToggleEngine={handleToggleEngine}
            onEngineIntent={handleEngineIntent}
            onToggleDispatch={setDispatchEnabled}
            onSensitivityChange={setSensitivity}
            onRecenter={recenterCursor}
            onCalibrate={engine.calibrateNeutral}
            calibration={engine.calibration}
            previewEnabled={previewEnabled}
            onTogglePreview={handleTogglePreview}
            preview={
                // La pinta el worker (imagen y máscara del mismo fotograma):
                // no hace falta un segundo <video> y el hilo del juego no
                // dibuja nada.
                <FaceMeshView
                    engine={engine}
                    mode="synced"
                    mesh="full"
                    className="aspect-[4/3] w-full rounded-xl border border-border/60 bg-black shadow-sm"
                >
                    <Camera
                        aria-hidden="true"
                        className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white/30"
                    />
                </FaceMeshView>
            }
        />
    );

    return (
        <AppLayout>
            <Head title={game.name} />

            {/* Enlace de salto para usuarios de teclado — visualmente oculto, visible al recibir foco */}
            <a
                href="#game-frame"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
                {t('play.skip_to_game')}
            </a>

            <NowPlayingHeader
                gameName={game.name}
                gameDescription={game.description}
                panelOpen={panelOpen}
                onPanelOpenChange={setPanelOpen}
                panelContent={panelContent}
            />

            {presetSuggestion && (
                <PresetSuggestionBanner
                    preset={presetSuggestion}
                    onAccept={handleAcceptPreset}
                    onDismiss={dismissPresetSuggestion}
                />
            )}

            {/* Layout principal: iframe + panel desktop */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* ── Contenedor del iframe ───────────────────────────────── */}
                <div
                    id="game-frame"
                    data-engine-status={engine.status}
                    data-engine-runtime={warmEngineState}
                    data-handshake-status={handshake.status}
                    className={cn(
                        'group relative aspect-video w-full overflow-hidden rounded-2xl border bg-black transition-all duration-500',
                        engine.status === 'running'
                            ? 'border-primary/40 shadow-2xl ring-1 shadow-primary/20 ring-primary/30'
                            : 'border-border/60 shadow-xl shadow-black/20',
                    )}
                >
                    {/* Halo decorativo cuando el motor está activo */}
                    {engine.status === 'running' && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 z-30 rounded-2xl"
                            style={{
                                background:
                                    'radial-gradient(circle at top left, color-mix(in oklch, var(--primary) 18%, transparent), transparent 35%), radial-gradient(circle at bottom right, color-mix(in oklch, var(--primary) 14%, transparent), transparent 35%)',
                            }}
                        />
                    )}

                    {/* Skeleton shimmer solo mientras esperamos el handshake READY */}
                    {handshake.status === 'waiting' && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)]"
                        >
                            <div className="iframe-shimmer absolute inset-0" />
                        </div>
                    )}

                    <iframe
                        ref={iframeRef}
                        src={game.embed_url}
                        title={game.name}
                        aria-label={t('play.iframe.aria_label', {
                            game: game.name,
                        })}
                        sandbox="allow-scripts allow-same-origin allow-orientation-lock"
                        allow="autoplay; fullscreen; clipboard-write; web-share"
                        className={cn(
                            'absolute inset-0 size-full border-0 transition-opacity duration-700 ease-out',
                            handshake.status === 'authenticated'
                                ? 'opacity-100'
                                : 'opacity-0',
                        )}
                    />

                    {/* Cursor de head-tracking (actualización imperativa — sin re-renders React) */}
                    {headTrackingMode === 'cursor' && (
                        <CursorOverlay ref={cursorRef} />
                    )}

                    {/* Overlay debug de Telemetría */}
                    {showTelemetry && telemetryView && (
                        <div className="pointer-events-none absolute top-4 left-4 z-50 rounded-lg border border-white/10 bg-black/80 p-3 text-white shadow-xl backdrop-blur-md">
                            <div className="mb-2 flex items-center justify-between border-b border-white/20 pb-1 text-xs font-bold">
                                <span>Telemetry</span>
                                <span className="ml-4 font-normal opacity-50">
                                    Ctrl+M to hide
                                </span>
                            </div>
                            <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 border-b border-white/20 pb-1 font-mono text-[10px]">
                                {telemetryView.info.map(([name, value]) => (
                                    <div
                                        key={name}
                                        className="contents"
                                        data-telemetry-info={name}
                                        data-value={value}
                                    >
                                        <dt className="opacity-70">{name}</dt>
                                        <dd
                                            className="max-w-56 truncate"
                                            title={value}
                                        >
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            <div className="space-y-1 font-mono text-[10px]">
                                {Object.entries(telemetryView.stats)
                                    .sort()
                                    .map(([key, stats]) => (
                                        <div
                                            key={key}
                                            className="flex justify-between gap-6"
                                            data-telemetry-metric={key}
                                            data-p50={stats.p50}
                                        >
                                            <span className="opacity-70">
                                                {key}
                                            </span>
                                            <span>
                                                <span className="opacity-50">
                                                    p50:
                                                </span>{' '}
                                                {stats.p50.toFixed(1)}
                                                <span className="ml-1 opacity-50">
                                                    avg:
                                                </span>{' '}
                                                {stats.avg.toFixed(1)}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    <EngineOverlay
                        engineStatus={engine.status}
                        handshakeStatus={handshake.status}
                        errorMessage={errorMessage}
                        onRetry={handleToggleEngine}
                        onRetryGame={handleRetryGame}
                    />
                </div>

                {/* ── Panel desktop (oculto en < lg) ─────────────────────── */}
                <aside
                    aria-label={t('play.panel.title')}
                    className="hidden lg:block"
                >
                    <div className="relative h-full rounded-2xl border border-border/60 bg-card p-5 shadow-lg shadow-black/5 dark:shadow-black/20">
                        {/* Pulso al detectar un gesto: solo se remonta esta capa
                            (reinicia la animación), no el panel entero. */}
                        {lastGesture && (
                            <span
                                key={lastGesture}
                                aria-hidden="true"
                                className="motion-safe:animate-gesture-pulse pointer-events-none absolute inset-0 rounded-2xl"
                            />
                        )}
                        {panelContent}
                    </div>
                </aside>
            </div>

            {/* ── Anuncio a11y para cambios de estado del motor ──────────── */}
            {/* Región live polite, visualmente oculta pero leída por SR */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {t(`play.engine.${engine.status}`)}
            </div>

            {/* ── Anuncio a11y de gestos detectados ─────────────────────── */}
            {/* Solo activo cuando el dispatch está habilitado — evita spam de SR */}
            {/* cuando el usuario no usa control facial activamente.              */}
            {dispatchEnabled && lastGesture && (
                <div
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                    className="sr-only"
                >
                    {t('play.a11y.gesture_detected', { gesture: lastGesture })}
                </div>
            )}

            {/* <video> oculto — alimenta el motor de visión sin mostrarse al usuario */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="pointer-events-none fixed -left-[9999px] size-px opacity-0"
                aria-hidden="true"
            />
        </AppLayout>
    );
}
