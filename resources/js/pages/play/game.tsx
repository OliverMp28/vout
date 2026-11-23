/**
 * Página del reproductor de juegos embebidos (Fase 3.3).
 *
 * Este componente es un render puro: la lógica de orquestación, estado y
 * efectos vive en `usePlayOrchestrator`, y qué se ofrece del control facial
 * lo decide `lib/play/play-mode.ts`.
 *
 * Layout ("el juego primero"):
 *  - El juego ocupa todo el ancho que cabe sin pasarse del alto de la
 *    pantalla. El control facial va detrás del botón "Control facial" de la
 *    cabecera, y solo en juegos que reciben los controles de Vout.
 *  - Desktop ≥ lg: el panel es una columna a la derecha que empuja al juego
 *    (no lo tapa). Sale abierto para quien juega con la cámara y se recuerda
 *    cómo lo deja cada usuario.
 *  - Tablet/móvil: el panel es una hoja, cerrada al entrar.
 *  - El iframe no cambia de sitio en el árbol: abrir o cerrar el panel no
 *    recarga el juego.
 *
 * Reglas inamovibles:
 *  - El access token NUNCA aparece en URL — solo viaja por postMessage.
 *  - `targetOrigin` de postMessage siempre es el origen validado (jamás '*').
 *  - Teclas retenidas se liberan al perder foco (visibilitychange + blur).
 */

import { Head, router, usePage } from '@inertiajs/react';
import { Camera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CameraThumbnail } from '@/components/play/camera-thumbnail';
import { ControlPanel } from '@/components/play/control-panel';
import type { CameraNotice } from '@/components/play/control-panel';
import { CursorOverlay } from '@/components/play/cursor-overlay';
import type { CursorOverlayHandle } from '@/components/play/cursor-overlay';
import { EngineOverlay } from '@/components/play/engine-overlay';
import { NowPlayingHeader } from '@/components/play/now-playing-header';
import { PlayToolbar } from '@/components/play/play-toolbar';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { FaceMeshView } from '@/components/vision/face-mesh-view';
import type { GameSessionPayload } from '@/hooks/use-game-session';
import { useWarmEngineState } from '@/hooks/use-gesture-engine';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useMascotContext } from '@/hooks/use-mascot-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePlayOrchestrator } from '@/hooks/use-play-orchestrator';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import { sendJson } from '@/lib/json-request';
import { describeDiagnostics } from '@/lib/mediapipe/diagnostics';
import type { TelemetrySnapshot } from '@/lib/mediapipe/telemetry';
import type { GestureConfigData } from '@/lib/mediapipe/types';
import {
    decidePlayMode,
    previewSlot,
    readPlayPreferences,
} from '@/lib/play/play-mode';
import { cn } from '@/lib/utils';
import { update as updatePlayPreferences } from '@/routes/play-preferences';
import type { FacialControlSupport } from '@/types';
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
        facial_control_support: FacialControlSupport;
    };
    activeGestureConfig: GestureConfigData | null;
    /** Qué controles eligió el usuario para este juego (ver PresetChoiceController). */
    presetChoice: string | null;
    session: GameSessionPayload;
};

/** Ids del panel (para `aria-controls` del botón "Control facial"). */
const DESKTOP_PANEL_ID = 'play-control-panel';
const SHEET_PANEL_ID = 'play-control-panel-sheet';

/**
 * Guarda una preferencia de la página de juego con la cuenta, sin recargar
 * la página (una visita de Inertia emitiría otro token de sesión), y la
 * refleja en las props para que volver atrás no muestre la antigua.
 *
 * Las props se copian por encima, sin clonar el resto: `game` o `session`
 * con otra identidad reiniciarían el handshake con el juego.
 */
function savePlayPreference(
    field: 'play_panel_open' | 'show_camera_preview',
    value: boolean,
): void {
    void sendJson(updatePlayPreferences.url(), 'PATCH', { [field]: value });

    router.replace({
        preserveScroll: true,
        preserveState: true,
        props: (props) => {
            const auth = props.auth as Auth;
            const settings = auth.user.settings;

            if (settings === null) {
                return props;
            }

            return {
                ...props,
                auth: {
                    ...auth,
                    user: {
                        ...auth.user,
                        settings: { ...settings, [field]: value },
                    },
                },
            };
        },
    });
}

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
    presetChoice,
    session,
}: PlayGameProps) {
    const { t } = useTranslation();
    const { auth } = usePage<{ auth: Auth }>().props;
    const isDesktop = useIsDesktop();
    const isMobile = useIsMobile();

    // Qué se ofrece del control facial a este usuario en este juego.
    const preferences = readPlayPreferences(auth.user.settings);
    const mode = decidePlayMode({
        usage: preferences.usage,
        support: game.facial_control_support,
        hasProfile: activeGestureConfig !== null,
        panelPreference: preferences.panelOpen,
    });

    // ── Refs DOM ───────────────────────────────────────────────────────────
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cursorRef = useRef<CursorOverlayHandle | null>(null);

    // Solo lo que NO pertenece al orquestador (estado de layout puro).
    // En escritorio el panel es una columna que se recuerda; en móvil, una
    // hoja que sale cerrada.
    const [desktopPanelOpen, setDesktopPanelOpen] = useState(
        mode.panelOpenByDefault,
    );
    const [sheetOpen, setSheetOpen] = useState(false);
    const panelVisible =
        mode.cameraAvailable && (isDesktop ? desktopPanelOpen : sheetOpen);
    const showDesktopPanel =
        mode.cameraAvailable && isDesktop && desktopPanelOpen;

    const handleTogglePanel = useCallback(() => {
        if (!isDesktop) {
            setSheetOpen((open) => !open);
            return;
        }

        setDesktopPanelOpen(!desktopPanelOpen);
        savePlayPreference('play_panel_open', !desktopPanelOpen);
    }, [isDesktop, desktopPanelOpen]);

    const [showTelemetry, setShowTelemetry] = useState(false);
    const [telemetryView, setTelemetryView] = useState<TelemetryView | null>(
        null,
    );
    // Ver la cámara mientras se juega: apagado por defecto, se guarda con la
    // cuenta.
    const [previewEnabled, setPreviewEnabled] = useState(
        preferences.showCameraPreview,
    );
    const handleTogglePreview = useCallback((enabled: boolean) => {
        setPreviewEnabled(enabled);
        savePlayPreference('show_camera_preview', enabled);
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
        suggestedPreset,
        activeGamePreset,
        askPresetChoice,
        errorMessage,
        engine,
        handshake,
        camera,
        handleToggleEngine,
        handleEngineIntent,
        handleRetryGame,
        handleSelectCamera,
        choosePreset,
        recenterCursor,
        setDispatchEnabled,
        setSensitivity,
    } = usePlayOrchestrator({
        game,
        activeGestureConfig,
        presetChoice,
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
            when:
                engine.status !== 'running' &&
                hasGestureConfig &&
                mode.cameraAvailable &&
                !mode.inviteToTry,
            text: t('mascot.context.play.engine_off'),
        },
        // Invitación discreta para quien no usa la cámara: solo si le habla.
        {
            id: 'play.game.invite',
            priority: 5,
            when: engine.status !== 'running' && mode.inviteToTry,
            text: t('mascot.context.play.invite'),
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

    // ── Vista de la cámara: en el panel si se ve, si no sobre el juego ────
    const engineActive = engine.status === 'running';
    const cameraPreviewSlot = previewSlot({
        previewEnabled,
        engineActive,
        panelVisible,
    });

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
                cameraPreviewSlot === 'panel' ? (
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
                ) : null
            }
            suggestedPreset={suggestedPreset}
            activeGamePreset={activeGamePreset}
            askPresetChoice={askPresetChoice}
            onChoosePreset={choosePreset}
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
                toolbar={
                    <PlayToolbar
                        mode={mode}
                        panelOpen={panelVisible}
                        panelId={isDesktop ? DESKTOP_PANEL_ID : SHEET_PANEL_ID}
                        onTogglePanel={handleTogglePanel}
                        cameraStatus={{
                            engineStatus: engine.status,
                            cameraBusy: camera.busy,
                            onToggleEngine: handleToggleEngine,
                            onEngineIntent: handleEngineIntent,
                        }}
                    />
                }
            />

            {/* Panel en tablet/móvil: hoja (en móvil sale por abajo, para el pulgar) */}
            {mode.cameraAvailable && !isDesktop && (
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent
                        id={SHEET_PANEL_ID}
                        side={isMobile ? 'bottom' : 'right'}
                        className={
                            isMobile
                                ? 'max-h-[85vh] rounded-t-2xl border-t-border/60 bg-card/95 backdrop-blur-xl'
                                : 'w-full border-l-border/60 bg-card/95 backdrop-blur-xl sm:max-w-sm'
                        }
                    >
                        <SheetHeader className="border-b border-border/50 pb-4">
                            <SheetTitle className="text-lg tracking-tight">
                                {t('play.panel.title')}
                            </SheetTitle>
                            <SheetDescription className="text-xs">
                                {t('play.panel.title_hint')}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="overflow-y-auto px-4 pt-2 pb-6">
                            {panelContent}
                        </div>
                    </SheetContent>
                </Sheet>
            )}

            {/* Layout principal: el juego y, si está abierto, el panel */}
            <div
                className={cn(
                    'grid gap-5',
                    showDesktopPanel && 'grid-cols-[minmax(0,1fr)_340px]',
                )}
            >
                {/* ── Escenario: el juego, centrado y sin pasarse del alto ─── */}
                <div id="play-stage" className="relative min-w-0">
                    {/* ── Contenedor del iframe ───────────────────────────────── */}
                    <div
                        id="game-frame"
                        data-engine-status={engine.status}
                        data-engine-runtime={warmEngineState}
                        data-handshake-status={handshake.status}
                        data-suggested-preset={suggestedPreset ?? ''}
                        data-preset-choice={activeGamePreset ?? 'own'}
                        className={cn(
                            'group relative mx-auto aspect-video w-full max-w-[calc((100dvh-13rem)*16/9)] overflow-hidden rounded-2xl border bg-black transition-[border-color,box-shadow] duration-500',
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
                                            <dt className="opacity-70">
                                                {name}
                                            </dt>
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

                        {/* Cámara en miniatura cuando el panel no se ve */}
                        {cameraPreviewSlot === 'stage' && (
                            <CameraThumbnail
                                engine={engine}
                                onHide={() => handleTogglePreview(false)}
                            />
                        )}

                        <EngineOverlay
                            engineStatus={engine.status}
                            handshakeStatus={handshake.status}
                            errorMessage={errorMessage}
                            onRetry={handleToggleEngine}
                            onRetryGame={handleRetryGame}
                        />
                    </div>
                </div>

                {/* ── Panel desktop: columna que empuja al juego ─────────── */}
                {showDesktopPanel && (
                    <aside
                        id={DESKTOP_PANEL_ID}
                        aria-label={t('play.panel.title')}
                        className="max-h-[calc(100dvh-13rem)] overflow-y-auto rounded-2xl"
                    >
                        <div className="relative min-h-full rounded-2xl border border-border/60 bg-card p-5 shadow-lg shadow-black/5 dark:shadow-black/20">
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
                )}
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
