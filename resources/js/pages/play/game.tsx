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
import { useCallback, useRef, useState } from 'react';

import { ControlPanel } from '@/components/play/control-panel';
import { CursorOverlay } from '@/components/play/cursor-overlay';
import type { CursorOverlayHandle } from '@/components/play/cursor-overlay';
import { EngineOverlay } from '@/components/play/engine-overlay';
import { NowPlayingHeader } from '@/components/play/now-playing-header';
import { PresetSuggestionBanner } from '@/components/play/preset-suggestion-banner';
import { usePlayOrchestrator } from '@/hooks/use-play-orchestrator';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import type { GestureConfigData } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';
import appearance from '@/routes/appearance';
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
    accessToken: string | null;
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function PlayGame({ game, activeGestureConfig, accessToken }: PlayGameProps) {
    const { t } = useTranslation();
    const { auth } = usePage<{ auth: Auth }>().props;

    // ── Refs DOM ───────────────────────────────────────────────────────────
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cursorRef = useRef<CursorOverlayHandle | null>(null);

    // ── Estado mínimo de UI del componente ─────────────────────────────────
    // Solo lo que NO pertenece al orquestador (estado de layout puro).
    const [panelOpen, setPanelOpen] = useState(false);

    // ── Callback imperativo para el cursor (evita setState a 30fps) ────────
    const handleCursorMove = useCallback((x: number, y: number, visible: boolean) => {
        cursorRef.current?.setPosition(x, y, visible);
    }, []);

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
        handleToggleEngine,
        handleRetryGame,
        handleAcceptPreset,
        setDispatchEnabled,
        setSensitivity,
        dismissPresetSuggestion,
    } = usePlayOrchestrator({
        game,
        activeGestureConfig,
        accessToken,
        user: auth.user,
        iframeRef,
        videoRef,
        onCursorMove: handleCursorMove,
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
            onToggleEngine={handleToggleEngine}
            onToggleDispatch={setDispatchEnabled}
            onSensitivityChange={setSensitivity}
            onCalibrate={engine.calibrateNeutral}
        />
    );

    return (
        <AppLayout>
            <Head title={game.name} />

            {/* Enlace de salto para usuarios de teclado — visualmente oculto, visible al recibir foco */}
            <a
                href="#game-frame"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                    className={cn(
                        'group relative aspect-video w-full overflow-hidden rounded-2xl border bg-black transition-all duration-500',
                        engine.status === 'running'
                            ? 'border-primary/40 shadow-2xl shadow-primary/20 ring-1 ring-primary/30'
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
                        aria-label={t('play.iframe.aria_label', { game: game.name })}
                        sandbox="allow-scripts allow-same-origin"
                        allow="autoplay; fullscreen"
                        className={cn(
                            'absolute inset-0 size-full border-0 transition-opacity duration-700 ease-out',
                            handshake.status === 'authenticated' ? 'opacity-100' : 'opacity-0',
                        )}
                    />

                    {/* Cursor de head-tracking (actualización imperativa — sin re-renders React) */}
                    {headTrackingMode === 'cursor' && (
                        <CursorOverlay ref={cursorRef} />
                    )}

                    <EngineOverlay
                        engineStatus={engine.status}
                        handshakeStatus={handshake.status}
                        errorMessage={errorMessage}
                        hasGestureConfig={hasGestureConfig}
                        onActivate={handleToggleEngine}
                        onConfigure={() => { window.location.href = appearance.edit.url(); }}
                        onRetry={handleToggleEngine}
                        onRetryGame={handleRetryGame}
                    />
                </div>

                {/* ── Panel desktop (oculto en < lg) ─────────────────────── */}
                {/* El `key={lastGesture}` remonta el wrapper al llegar un gesto, */}
                {/* lo que reinicia la animación `gesture-pulse` (feedback visual). */}
                <aside
                    aria-label={t('play.panel.title')}
                    className="hidden lg:block"
                >
                    <div
                        key={lastGesture ?? 'idle'}
                        className={cn(
                            'h-full rounded-2xl border border-border/60 bg-card/70 p-5 shadow-xl shadow-black/5 backdrop-blur-md dark:bg-card/40 dark:shadow-black/20',
                            lastGesture && 'motion-safe:animate-gesture-pulse',
                        )}
                    >
                        {panelContent}
                    </div>
                </aside>
            </div>

            {/* ── Anuncio a11y para cambios de estado del motor ──────────── */}
            {/* Región live polite, visualmente oculta pero leída por SR */}
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {t(`play.engine.${engine.status}`)}
            </div>

            {/* ── Anuncio a11y de gestos detectados ─────────────────────── */}
            {/* Solo activo cuando el dispatch está habilitado — evita spam de SR */}
            {/* cuando el usuario no usa control facial activamente.              */}
            {dispatchEnabled && lastGesture && (
                <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
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
