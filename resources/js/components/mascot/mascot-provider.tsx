import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
} from 'react';
import type { Dispatch, ReactNode } from 'react';
import { useIdleTimer } from '@/hooks/use-idle-timer';
import type { MascotApi, MascotEvent, MascotState } from '@/types/mascot';

const ENTER_DURATION_MS = 600;
const CELEBRATE_DURATION_MS = 600;
const TAP_DURATION_MS = 200;
const SLEEP_TIMEOUT_MS = 120_000;

type ReducerState = {
    readonly state: MascotState;
};

const initialState: ReducerState = { state: 'entering' };

function reducer(current: ReducerState, event: MascotEvent): ReducerState {
    switch (event.type) {
        case 'ENTER_COMPLETE':
            return current.state === 'entering' ? { state: 'idle' } : current;
        case 'HOVER_START':
            return current.state === 'idle' || current.state === 'sleeping'
                ? { state: 'hovering' }
                : current;
        case 'HOVER_END':
            return current.state === 'hovering' ? { state: 'idle' } : current;
        case 'TAP':
            return current.state === 'idle' ||
                current.state === 'hovering' ||
                current.state === 'sleeping'
                ? { state: 'tapped' }
                : current;
        case 'TAP_COMPLETE':
            return current.state === 'tapped' ? { state: 'idle' } : current;
        case 'CELEBRATE':
            return { state: 'celebrating' };
        case 'CELEBRATE_COMPLETE':
            return current.state === 'celebrating'
                ? { state: 'idle' }
                : current;
        case 'SLEEP':
            return current.state === 'idle' ? { state: 'sleeping' } : current;
        case 'WAKE':
            return current.state === 'sleeping' ? { state: 'idle' } : current;
        case 'FORCE_SET':
            return { state: event.state };
        default:
            return current;
    }
}

export const MascotContext = createContext<MascotApi | null>(null);
export const MascotDispatchContext =
    createContext<Dispatch<MascotEvent> | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
    const [{ state }, dispatch] = useReducer(reducer, initialState);

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

    const api = useMemo<MascotApi>(
        () => ({
            state,
            celebrate,
            sleep,
            wake,
            setState,
        }),
        [state, celebrate, sleep, wake, setState],
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
