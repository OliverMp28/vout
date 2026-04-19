import { usePage } from '@inertiajs/react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useMascot, useMascotDispatch } from '@/hooks/use-mascot';
import { useTranslation } from '@/hooks/use-translation';
import type { MascotTone } from '@/types/mascot';
import { pickContextMessage } from './mascot-context-registry';
import { MascotTooltip } from './mascot-tooltip';
import { VouSvg } from './vou-svg';

// Duración más corta para tap — el usuario acaba de interactuar, no
// necesita mantener el tooltip mucho tiempo.
const TOOLTIP_TAP_AUTOCLOSE_MS = 2_500;

// Auto-show dura un poco más: el usuario no lo pidió explícitamente, así
// que necesita un plazo razonable para leerlo antes de que desaparezca.
const TOOLTIP_AUTO_AUTOCLOSE_MS = 4_500;

// Retardo entre el cambio de ruta y el posible auto-show. Da tiempo a que
// las páginas registren sus candidatos (los efectos corren después del
// commit) y a que la animación de entrada de Vou termine.
const AUTO_SHOW_DELAY_MS = 1_200;

// Intervalo mínimo entre dos auto-shows. Protege contra spam cuando el
// usuario navega deprisa entre páginas.
const AUTO_SHOW_MIN_INTERVAL_MS = 8_000;

const emptySubscribe = () => () => {};

/**
 * Render vía portal a <body> para escapar de cualquier ancestro con
 * `transform`/`filter`/`perspective` (p.ej. el <main> con animate-slide-up-fade),
 * que convertiría el `position: fixed` en fixed respecto a ese ancestro.
 */
export function Vou() {
    const { state, message } = useMascot();
    const dispatch = useMascotDispatch();
    const { t } = useTranslation();
    const page = usePage();

    // Evita advertencias de ESLint en React 19 sobre "cascading renders"
    // al mismo tiempo que protege createPortal en SSR.
    const mounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false,
    );

    const [greetingOpen, setGreetingOpen] = useState(false);
    const [greeting, setGreeting] = useState('');
    const [greetingTone, setGreetingTone] = useState<MascotTone>('info');
    const closeTimerRef = useRef<number | null>(null);

    // Dedup de auto-shows por id+texto y throttle global. Se mantienen en
    // refs — son puro estado de coordinación, no afectan al render.
    const seenAutoRef = useRef<Set<string>>(new Set());
    const lastAutoShowAtRef = useRef<number>(0);

    const showGreeting = useCallback(
        (text: string, tone: MascotTone, durationMs: number): void => {
            setGreeting(text);
            setGreetingTone(tone);
            setGreetingOpen(true);
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
            closeTimerRef.current = window.setTimeout(() => {
                setGreetingOpen(false);
                closeTimerRef.current = null;
            }, durationMs);
        },
        [],
    );

    useEffect(() => {
        return () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    const greetings = useMemo(
        () => [
            t('mascot.greetings.0'),
            t('mascot.greetings.1'),
            t('mascot.greetings.2'),
        ],
        [t],
    );

    const handleHoverStart = useCallback((): void => {
        dispatch({ type: 'HOVER_START' });
    }, [dispatch]);

    const handleHoverEnd = useCallback((): void => {
        dispatch({ type: 'HOVER_END' });
    }, [dispatch]);

    const handleClick = useCallback((): void => {
        dispatch({ type: 'TAP' });
        // Prioridad 1: mensaje contextual declarado por la página actual.
        // Si no hay ninguno activo, fallback a un saludo aleatorio (S3).
        const contextMsg = pickContextMessage();
        if (contextMsg) {
            showGreeting(
                contextMsg.text,
                contextMsg.tone,
                TOOLTIP_TAP_AUTOCLOSE_MS,
            );
        } else {
            const msg =
                greetings[Math.floor(Math.random() * greetings.length)];
            showGreeting(msg, 'info', TOOLTIP_TAP_AUTOCLOSE_MS);
        }
    }, [dispatch, greetings, showGreeting]);

    // ── Auto-show contextual ───────────────────────────────────────────
    // Al cambiar de ruta, tras un delay corto, intentamos mostrar de
    // forma proactiva un mensaje contextual que la página haya marcado
    // como `auto: true`. Tres candados para evitar spam:
    //
    //   1. Skip si la mascota está entrando o si hay un flash de
    //      notify() activo (S6) — ese mensaje tiene prioridad.
    //   2. Throttle global: no más de un auto-show cada
    //      AUTO_SHOW_MIN_INTERVAL_MS ms.
    //   3. Dedup por `id|texto`: si ya mostramos este mensaje concreto
    //      en esta sesión, no volvemos a mostrarlo (el usuario puede
    //      tocar la mascota para reverlo).
    //
    // La ruta actual se toma de `page.url`, que cambia en cada
    // navegación SPA — eso re-dispara el efecto naturalmente.
    useEffect(() => {
        if (state === 'entering' || message !== null) {
            return;
        }
        const timer = window.setTimeout(() => {
            const now = Date.now();
            if (now - lastAutoShowAtRef.current < AUTO_SHOW_MIN_INTERVAL_MS) {
                return;
            }
            const contextMsg = pickContextMessage({ autoOnly: true });
            if (contextMsg === null) {
                return;
            }
            const dedupKey = `${contextMsg.id}|${contextMsg.text}`;
            if (seenAutoRef.current.has(dedupKey)) {
                return;
            }
            seenAutoRef.current.add(dedupKey);
            lastAutoShowAtRef.current = now;
            showGreeting(
                contextMsg.text,
                contextMsg.tone,
                TOOLTIP_AUTO_AUTOCLOSE_MS,
            );
        }, AUTO_SHOW_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [page.url, state, message, showGreeting]);

    if (!mounted) {
        return null;
    }

    const ariaLabel =
        state === 'sleeping'
            ? t('mascot.sleeping_aria')
            : t('mascot.aria_label');

    // Una notificación activa (S6) tiene prioridad sobre el tooltip del tap.
    // Si no hay notificación, mostramos el último saludo/mensaje contextual
    // manteniendo su tono (S7 puede declarar tonos distintos a `info`).
    const tooltipMessage = message?.text ?? greeting;
    const tooltipOpen = message !== null || greetingOpen;
    const tooltipTone: MascotTone = message?.tone ?? greetingTone;

    return createPortal(
        <div
            data-state={state}
            className="vou-mascot fixed right-6 bottom-6 z-40 hidden h-20 w-20 sm:block"
        >
            <MascotTooltip
                message={tooltipMessage}
                open={tooltipOpen}
                tone={tooltipTone}
            />
            <button
                type="button"
                onMouseEnter={handleHoverStart}
                onMouseLeave={handleHoverEnd}
                onFocus={handleHoverStart}
                onBlur={handleHoverEnd}
                onClick={handleClick}
                aria-label={ariaLabel}
                className="vou-button block h-full w-full cursor-pointer rounded-2xl transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
                <VouSvg />
            </button>
        </div>,
        document.body,
    );
}
