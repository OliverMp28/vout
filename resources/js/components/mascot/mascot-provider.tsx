import { usePage } from '@inertiajs/react';
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
} from 'react';
import type { Dispatch, ReactNode } from 'react';
import { useIdleTimer } from '@/hooks/use-idle-timer';
import { useTranslation } from '@/hooks/use-translation';
import type {
    GuideStep,
    MascotApi,
    MascotEvent,
    MascotGuidance,
    MascotMessage,
    MascotState,
    MascotTone,
} from '@/types/mascot';

const ENTER_DURATION_MS = 600;
const CELEBRATE_DURATION_MS = 1_000;
const TAP_DURATION_MS = 200;
const SLEEP_TIMEOUT_MS = 120_000;
const DEFAULT_NOTIFY_DURATION_MS = 3_500;
const ERROR_NOTIFY_DURATION_MS = 5_000;

type ReducerState = {
    readonly state: MascotState;
    readonly message: MascotMessage | null;
    readonly guidance: MascotGuidance | null;
};

const initialState: ReducerState = {
    state: 'entering',
    message: null,
    guidance: null,
};

function reducer(current: ReducerState, event: MascotEvent): ReducerState {
    switch (event.type) {
        case 'ENTER_COMPLETE':
            return current.state === 'entering'
                ? { ...current, state: 'idle' }
                : current;
        case 'HOVER_START':
            return current.state === 'idle' || current.state === 'sleeping'
                ? { ...current, state: 'hovering' }
                : current;
        case 'HOVER_END':
            return current.state === 'hovering'
                ? { ...current, state: 'idle' }
                : current;
        case 'TAP':
            return current.state === 'idle' ||
                current.state === 'hovering' ||
                current.state === 'sleeping'
                ? { ...current, state: 'tapped' }
                : current;
        case 'TAP_COMPLETE':
            return current.state === 'tapped'
                ? { ...current, state: 'idle' }
                : current;
        case 'CELEBRATE':
            return { ...current, state: 'celebrating' };
        case 'CELEBRATE_COMPLETE':
            return current.state === 'celebrating'
                ? { ...current, state: 'idle' }
                : current;
        case 'SLEEP':
            return current.state === 'idle'
                ? { ...current, state: 'sleeping' }
                : current;
        case 'WAKE':
            return current.state === 'sleeping'
                ? { ...current, state: 'idle' }
                : current;
        case 'FORCE_SET':
            return { ...current, state: event.state };
        case 'NOTIFY':
            return { ...current, message: event.message };
        case 'CLEAR_MESSAGE':
            return current.message === null
                ? current
                : { ...current, message: null };
        case 'GUIDE_SET': {
            const prev = current.guidance;
            if (
                prev !== null &&
                prev.currentIndex === event.guidance.currentIndex &&
                guideStepsEqual(prev.steps, event.guidance.steps)
            ) {
                return current;
            }
            return { ...current, guidance: event.guidance };
        }
        case 'GUIDE_CLEAR':
            return current.guidance === null
                ? current
                : { ...current, guidance: null };
        default:
            return current;
    }
}

function guideStepsEqual(
    a: readonly GuideStep[],
    b: readonly GuideStep[],
): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (
            a[i].key !== b[i].key ||
            a[i].text !== b[i].text ||
            a[i].done !== b[i].done
        ) {
            return false;
        }
    }
    return true;
}

export const MascotContext = createContext<MascotApi | null>(null);
export const MascotDispatchContext =
    createContext<Dispatch<MascotEvent> | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
    const [{ state, message, guidance }, dispatch] = useReducer(
        reducer,
        initialState,
    );

    useEffect(() => {
        if (state !== 'entering') {
            return;
        }
        const timeout = window.setTimeout(() => {
            dispatch({ type: 'ENTER_COMPLETE' });
        }, ENTER_DURATION_MS);
        return () => window.clearTimeout(timeout);
    }, [state]);

    useEffect(() => {
        if (state !== 'celebrating') {
            return;
        }
        const timeout = window.setTimeout(() => {
            dispatch({ type: 'CELEBRATE_COMPLETE' });
        }, CELEBRATE_DURATION_MS);
        return () => window.clearTimeout(timeout);
    }, [state]);

    useEffect(() => {
        if (state !== 'tapped') {
            return;
        }
        const timeout = window.setTimeout(() => {
            dispatch({ type: 'TAP_COMPLETE' });
        }, TAP_DURATION_MS);
        return () => window.clearTimeout(timeout);
    }, [state]);

    useEffect(() => {
        if (message === null) {
            return;
        }
        const remaining = message.expiresAt - Date.now();
        if (remaining <= 0) {
            dispatch({ type: 'CLEAR_MESSAGE' });
            return;
        }
        const timeout = window.setTimeout(() => {
            dispatch({ type: 'CLEAR_MESSAGE' });
        }, remaining);
        return () => window.clearTimeout(timeout);
    }, [message]);

    const handleIdle = useCallback((): void => {
        dispatch({ type: 'SLEEP' });
    }, []);

    const handleActive = useCallback((): void => {
        dispatch({ type: 'WAKE' });
    }, []);

    useIdleTimer(handleIdle, handleActive, SLEEP_TIMEOUT_MS);

    const celebrate = useCallback((): void => {
        dispatch({ type: 'CELEBRATE' });
    }, []);

    const sleep = useCallback((): void => {
        dispatch({ type: 'SLEEP' });
    }, []);

    const wake = useCallback((): void => {
        dispatch({ type: 'WAKE' });
    }, []);

    const setState = useCallback((next: MascotState): void => {
        dispatch({ type: 'FORCE_SET', state: next });
    }, []);

    const notify = useCallback(
        (text: string, tone: MascotTone = 'info', durationMs?: number): void => {
            const fallback =
                tone === 'error'
                    ? ERROR_NOTIFY_DURATION_MS
                    : DEFAULT_NOTIFY_DURATION_MS;
            const duration = durationMs ?? fallback;
            dispatch({
                type: 'NOTIFY',
                message: {
                    text,
                    tone,
                    expiresAt: Date.now() + duration,
                },
            });
        },
        [],
    );

    const clearMessage = useCallback((): void => {
        dispatch({ type: 'CLEAR_MESSAGE' });
    }, []);

    const guide = useCallback(
        (
            steps: readonly GuideStep[] | null,
            currentIndex: number = 0,
        ): void => {
            if (steps === null || steps.length === 0) {
                dispatch({ type: 'GUIDE_CLEAR' });
                return;
            }
            const clamped = Math.min(
                Math.max(0, currentIndex),
                steps.length - 1,
            );
            dispatch({
                type: 'GUIDE_SET',
                guidance: { steps, currentIndex: clamped },
            });
        },
        [],
    );

    useFlashWatcher(notify, celebrate);

    const api = useMemo<MascotApi>(
        () => ({
            state,
            message,
            guidance,
            celebrate,
            sleep,
            wake,
            setState,
            notify,
            clearMessage,
            guide,
        }),
        [
            state,
            message,
            guidance,
            celebrate,
            sleep,
            wake,
            setState,
            notify,
            clearMessage,
            guide,
        ],
    );

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        (window as unknown as { __vou?: MascotApi }).__vou = api;
        return () => {
            delete (window as unknown as { __vou?: MascotApi }).__vou;
        };
    }, [api]);

    return (
        <MascotContext.Provider value={api}>
            <MascotDispatchContext.Provider value={dispatch}>
                {children}
            </MascotDispatchContext.Provider>
        </MascotContext.Provider>
    );
}

type FlashProps = {
    status: string | null;
    error: string | null;
};

function useFlashWatcher(
    notify: (text: string, tone?: MascotTone, durationMs?: number) => void,
    celebrate: () => void,
): void {
    const page = usePage<{ flash?: FlashProps }>();
    const flash = page.props.flash ?? { status: null, error: null };
    const { t } = useTranslation();
    const lastSeen = useRef<{ status: string | null; error: string | null }>({
        status: null,
        error: null,
    });

    useEffect(() => {
        if (flash.status && flash.status !== lastSeen.current.status) {
            lastSeen.current.status = flash.status;
            const translated = t(flash.status);
            const text = translated === flash.status ? flash.status : translated;
            notify(text, 'success');
            celebrate();
        } else if (!flash.status) {
            lastSeen.current.status = null;
        }

        if (flash.error && flash.error !== lastSeen.current.error) {
            lastSeen.current.error = flash.error;
            const translated = t(flash.error);
            const text = translated === flash.error ? flash.error : translated;
            notify(text, 'error');
        } else if (!flash.error) {
            lastSeen.current.error = null;
        }
    }, [flash.status, flash.error, notify, celebrate, t]);
}
