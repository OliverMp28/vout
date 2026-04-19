export type MascotState =
    | 'entering'
    | 'idle'
    | 'hovering'
    | 'tapped'
    | 'celebrating'
    | 'sleeping';

export type MascotEvent =
    | { type: 'ENTER_COMPLETE' }
    | { type: 'HOVER_START' }
    | { type: 'HOVER_END' }
    | { type: 'TAP' }
    | { type: 'TAP_COMPLETE' }
    | { type: 'CELEBRATE' }
    | { type: 'CELEBRATE_COMPLETE' }
    | { type: 'SLEEP' }
    | { type: 'WAKE' }
    | { type: 'FORCE_SET'; state: MascotState };

export type MascotApi = {
    readonly state: MascotState;
    readonly celebrate: () => void;
    readonly sleep: () => void;
    readonly wake: () => void;
    readonly setState: (state: MascotState) => void;
};
