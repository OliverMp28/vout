import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useMascot, useMascotDispatch } from '@/hooks/use-mascot';
import { useTranslation } from '@/hooks/use-translation';
import { MascotTooltip } from './mascot-tooltip';
import { VouSvg } from './vou-svg';

const TOOLTIP_AUTOCLOSE_MS = 2500;

const emptySubscribe = () => () => {};

/**
 * Render vía portal a <body> para escapar de cualquier ancestro con
 * `transform`/`filter`/`perspective` (p.ej. el <main> con animate-slide-up-fade),
 * que convertiría el `position: fixed` en fixed respecto a ese ancestro.
 */
export function Vou() {
    const { state } = useMascot();
    const dispatch = useMascotDispatch();
    const { t } = useTranslation();

    // Evita advertencias de ESLint en React 19 sobre "cascading renders"
    // al mismo tiempo que protege createPortal en SSR.
    const mounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false,
    );

    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipMessage, setTooltipMessage] = useState('');

    useEffect(() => {
        if (!tooltipOpen) {
            return;
        }
        const timeout = window.setTimeout(() => {
            setTooltipOpen(false);
        }, TOOLTIP_AUTOCLOSE_MS);
        return () => window.clearTimeout(timeout);
    }, [tooltipOpen]);

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
        const msg = greetings[Math.floor(Math.random() * greetings.length)];
        setTooltipMessage(msg);
        setTooltipOpen(true);
    }, [dispatch, greetings]);

    if (!mounted) {
        return null;
    }

    const ariaLabel =
        state === 'sleeping'
            ? t('mascot.sleeping_aria')
            : t('mascot.aria_label');

    return createPortal(
        <div
            data-state={state}
            className="vou-mascot fixed right-6 bottom-6 z-40 hidden h-20 w-20 sm:block"
        >
            <MascotTooltip message={tooltipMessage} open={tooltipOpen} />
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
