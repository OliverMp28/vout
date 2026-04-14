/**
 * Overlay semitransparente sobre el iframe del juego.
 *
 * Principio rector de Fase 3.5: el overlay NUNCA debe bloquear al usuario
 * cuando el juego ya está listo para jugar. Solo se muestra en situaciones
 * que impiden la jugabilidad (handshake en curso, motor cargando, error,
 * timeout). Si el motor está idle pero el handshake está autenticado, el
 * usuario ya puede jugar con teclado/ratón y el overlay debe ceder el paso
 * — el CTA de activación vive ahora exclusivamente en el panel lateral.
 *
 * Es totalmente accesible: usa `role="status"` y `aria-live="polite"` para
 * anunciar cambios de estado a lectores de pantalla sin interrumpir la
 * navegación.
 */

import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import type { HandshakeStatus } from '@/lib/iframe/types';
import type { EngineStatus } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

type EngineOverlayProps = {
    /** Estado del motor de visión (MediaPipe). */
    engineStatus: EngineStatus;
    /** Estado del handshake con el iframe del juego. */
    handshakeStatus: HandshakeStatus;
    /** Mensaje de error del motor o de la cámara, si existe. */
    errorMessage?: string | null;
    /** Disparado cuando el usuario pulsa "Reintentar" tras un error del motor. */
    onRetry: () => void;
    /** Disparado cuando el usuario pulsa "Reintentar" tras un timeout del juego. */
    onRetryGame: () => void;
};

/**
 * Resuelve qué tarjeta debe mostrarse según el estado combinado del
 * handshake y el motor. La prioridad es: error > handshake > engine.
 *
 * Regla crítica (Fase 3.5.1): si el motor está `idle` pero el handshake
 * está `authenticated`, devolvemos `hidden`. El juego es inmediatamente
 * jugable con teclado/ratón y el CTA de activar control facial sigue
 * disponible en el panel lateral sin bloquear la pantalla.
 */
function resolveCardKind(
    engineStatus: EngineStatus,
    handshakeStatus: HandshakeStatus,
): 'error' | 'timeout' | 'handshake' | 'loading' | 'hidden' {
    if (engineStatus === 'error' || handshakeStatus === 'error') {
        return 'error';
    }
    if (handshakeStatus === 'timeout') {
        return 'timeout';
    }
    if (handshakeStatus === 'waiting') {
        return 'handshake';
    }
    if (engineStatus === 'loading') {
        return 'loading';
    }
    return 'hidden';
}

export function EngineOverlay({
    engineStatus,
    handshakeStatus,
    errorMessage,
    onRetry,
    onRetryGame,
}: EngineOverlayProps) {
    const { t } = useTranslation();
    const kind = resolveCardKind(engineStatus, handshakeStatus);

    if (kind === 'hidden') {
        return null;
    }

    const isError = kind === 'error' || kind === 'timeout';

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4',
                'bg-black/45 backdrop-blur-md transition-opacity duration-300',
                'animate-in fade-in',
            )}
        >
            {/* Tarjeta principal: glass-card sobre fondo oscuro (iframe negro) — autorizado por el design system */}
            <div
                className={cn(
                    'glass-card pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl p-7 shadow-2xl',
                    'animate-in fade-in zoom-in-95 duration-300',
                )}
            >
                {/* Acento decorativo: halo radial sutil que diferencia idle (invitador) de error (urgente) */}
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full opacity-60 blur-3xl',
                        isError
                            ? 'bg-destructive/30'
                            : 'bg-[radial-gradient(circle_at_center,var(--vout-gradient-start),transparent_70%)]',
                    )}
                />

                <div className="relative flex flex-col items-center gap-4 text-center">
                    {kind === 'handshake' && (
                        <>
                            <IconBubble tone="primary">
                                <Loader2 className="size-7 animate-spin text-primary" />
                            </IconBubble>
                            <OverlayHeading>{t('play.overlay.handshake.title')}</OverlayHeading>
                            <OverlayBody>{t('play.overlay.handshake.description')}</OverlayBody>
                        </>
                    )}

                    {kind === 'loading' && (
                        <>
                            <IconBubble tone="primary">
                                <Loader2 className="size-7 animate-spin text-primary" />
                            </IconBubble>
                            <OverlayHeading>{t('play.overlay.loading.title')}</OverlayHeading>
                            <OverlayBody>{t('play.overlay.loading.description')}</OverlayBody>
                        </>
                    )}

                    {kind === 'timeout' && (
                        <>
                            <IconBubble tone="destructive">
                                <RefreshCw className="size-7 text-destructive" />
                            </IconBubble>
                            <OverlayHeading>{t('play.overlay.timeout.title')}</OverlayHeading>
                            <OverlayBody>{t('play.overlay.timeout.description')}</OverlayBody>
                            <Button onClick={onRetryGame} variant="secondary" className="mt-2">
                                {t('play.overlay.error.retry')}
                            </Button>
                        </>
                    )}

                    {kind === 'error' && (
                        <>
                            <IconBubble tone="destructive">
                                <AlertTriangle className="size-7 text-destructive" />
                            </IconBubble>
                            <OverlayHeading>{t('play.overlay.error.title')}</OverlayHeading>
                            <OverlayBody>
                                {errorMessage ?? t('play.overlay.error.description')}
                            </OverlayBody>
                            <Button onClick={onRetry} variant="secondary" className="mt-2">
                                {t('play.overlay.error.retry')}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Subcomponentes presentacionales ──────────────────────────────────────────
// Aislamos pequeños bloques presentacionales para mantener consistencia
// tipográfica y de spacing entre los cuatro estados del overlay.

function IconBubble({
    children,
    tone,
    glow = false,
}: {
    children: React.ReactNode;
    tone: 'primary' | 'destructive';
    glow?: boolean;
}) {
    return (
        <div
            className={cn(
                'relative flex size-14 items-center justify-center rounded-2xl',
                tone === 'primary'
                    ? 'bg-primary/12 ring-1 ring-primary/25'
                    : 'bg-destructive/10 ring-1 ring-destructive/25',
                glow && 'animate-glow-pulse',
            )}
        >
            {children}
        </div>
    );
}

function OverlayHeading({ children }: { children: React.ReactNode }) {
    return <h2 className="text-lg font-semibold tracking-tight text-foreground">{children}</h2>;
}

function OverlayBody({ children }: { children: React.ReactNode }) {
    return <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
