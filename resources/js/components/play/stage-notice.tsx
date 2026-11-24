/**
 * Avisos sobre la cámara encima del juego (abajo, sin taparlo entero): el
 * encendido automático y la cámara apagada por dejar la pestaña oculta.
 *
 * - `countdown`: "Encendiendo la cámara…" con cuenta atrás y "Ahora no". No
 *   roba el foco: quien juega con teclado sigue jugando.
 * - `ask`: sin permiso del navegador no se enciende sola. Se explica y el
 *   botón "Activar cámara" sale enfocado (basta Enter o un pulsador).
 * - `blocked`: el navegador tiene la cámara bloqueada; se dice cómo
 *   permitirla.
 * - `hidden-stop`: se apagó por dejar la pestaña oculta; se puede volver a
 *   activar desde aquí.
 *
 * Un solo anuncio para el lector de pantalla por aviso: los números de la
 * cuenta atrás no se leen.
 */

import { Link } from '@inertiajs/react';
import { Camera, Info, Video, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { AUTOSTART_COUNTDOWN_SECONDS } from '@/lib/play/autostart';
import appearance from '@/routes/appearance';

export type StageNoticeKind = 'countdown' | 'ask' | 'blocked' | 'hidden-stop';

type StageNoticeProps = {
    kind: StageNoticeKind;
    /** Segundos que quedan (`countdown`). */
    remaining?: number;
    /** Encender la cámara ya (`ask`, `hidden-stop`). */
    onActivate?: () => void;
    /** "Ahora no" o cerrar el aviso. */
    onDismiss: () => void;
    /** Devuelve el foco al juego tras cerrar. */
    onDone?: () => void;
};

export function StageNotice({
    kind,
    remaining = AUTOSTART_COUNTDOWN_SECONDS,
    onActivate,
    onDismiss,
    onDone,
}: StageNoticeProps) {
    const { t } = useTranslation();
    const activateRef = useRef<HTMLButtonElement | null>(null);

    // Sin permiso, el botón sale enfocado para quien no usa el ratón, pero
    // solo si nadie tiene el foco (no se le quita a quien ya está jugando).
    useEffect(() => {
        if (kind !== 'ask') {
            return;
        }

        if (
            document.activeElement === null ||
            document.activeElement === document.body
        ) {
            activateRef.current?.focus({ preventScroll: true });
        }
    }, [kind]);

    const dismiss = (): void => {
        onDismiss();
        onDone?.();
    };

    return (
        <div
            id="play-stage-notice"
            data-notice={kind}
            className="absolute inset-x-3 bottom-3 z-40 flex justify-center"
        >
            <div
                role="status"
                aria-live="polite"
                className="relative w-full max-w-md animate-in overflow-hidden rounded-surface border border-on-media/15 bg-scrim p-3.5 text-on-media shadow-overlay duration-300 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
            >
                <div className="flex items-start gap-3">
                    {kind === 'countdown' ? (
                        <span
                            aria-hidden="true"
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-on-media/10 font-mono text-sm font-semibold tabular-nums"
                        >
                            {remaining}
                        </span>
                    ) : kind === 'blocked' || kind === 'hidden-stop' ? (
                        <Info
                            aria-hidden="true"
                            className="mt-0.5 size-5 shrink-0 text-on-media-muted"
                        />
                    ) : (
                        <Camera
                            aria-hidden="true"
                            className="mt-0.5 size-5 shrink-0 text-on-media-muted"
                        />
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium">
                            {t(`play.stage_notice.${kind}.title`)}
                        </p>
                        <p className="text-xs text-on-media-muted">
                            {t(`play.stage_notice.${kind}.desc`)}{' '}
                            {kind === 'countdown' && (
                                <Link
                                    href={appearance.edit.url()}
                                    className="font-medium text-on-media underline-offset-2 hover:underline"
                                >
                                    {t('play.stage_notice.settings')}
                                </Link>
                            )}
                        </p>

                        <div className="flex flex-wrap gap-2 pt-1.5">
                            {(kind === 'ask' || kind === 'hidden-stop') &&
                                onActivate && (
                                    <Button
                                        ref={activateRef}
                                        type="button"
                                        id="play-stage-notice-activate"
                                        size="sm"
                                        onClick={onActivate}
                                        className="gap-1.5"
                                    >
                                        <Video
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                        {t('play.camera_status.start')}
                                    </Button>
                                )}
                            {kind === 'countdown' && (
                                <Button
                                    type="button"
                                    id="play-autostart-cancel"
                                    size="sm"
                                    variant="secondary"
                                    onClick={dismiss}
                                >
                                    {t('play.stage_notice.not_now')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {kind !== 'countdown' && (
                        <button
                            type="button"
                            id="play-stage-notice-close"
                            onClick={dismiss}
                            aria-label={t('play.stage_notice.close')}
                            className="rounded-full p-1 text-on-media-muted transition-colors duration-200 hover:bg-on-media/10 hover:text-on-media focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <X aria-hidden="true" className="size-4" />
                        </button>
                    )}
                </div>

                {kind === 'countdown' && (
                    <div
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-0.5 bg-on-media/10"
                    >
                        <div className="animate-autostart-progress h-full w-full bg-primary" />
                    </div>
                )}
            </div>
        </div>
    );
}
