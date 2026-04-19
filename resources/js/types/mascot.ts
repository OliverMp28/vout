export type MascotState =
    | 'entering'
    | 'idle'
    | 'hovering'
    | 'tapped'
    | 'celebrating'
    | 'sleeping';

export type MascotTone = 'success' | 'error' | 'info';

export type MascotMessage = {
    readonly text: string;
    readonly tone: MascotTone;
    readonly expiresAt: number;
};

/**
 * Candidato contextual declarado por una página mediante `useMascotContext()`.
 *
 * El provider mantiene un registro de candidatos vivos por source. Al hacer
 * tap en Vou, se selecciona el candidato activo de mayor prioridad, o se
 * hace fallback a un saludo aleatorio si ninguno aplica.
 *
 * - `id` identifica al candidato dentro de una misma source (útil para
 *   depuración y para que el auto-show pueda deduplicar por sesión).
 * - `priority` (default `0`) ordena candidatos activos de forma descendente.
 * - `when` se evalúa en el momento del tap — el provider consulta el ref
 *   del hook para leer siempre el último valor de React.
 * - `text` ya viene traducido e interpolado por la página. El provider no
 *   conoce i18n.
 * - `tone` por defecto es `info` (tooltip neutro).
 * - `auto` (default `false`) habilita el auto-show proactivo: Vou puede
 *   mostrar el mensaje al entrar en la ruta sin necesidad de tap. Se
 *   aplica throttle global y dedup por id+ruta para evitar spam.
 */
export type MessageCandidate = {
    readonly id: string;
    readonly priority?: number;
    readonly when: boolean;
    readonly text: string;
    readonly tone?: MascotTone;
    readonly auto?: boolean;
};

export type MascotContextMessage = {
    readonly id: string;
    readonly text: string;
    readonly tone: MascotTone;
};

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
    | { type: 'FORCE_SET'; state: MascotState }
    | { type: 'NOTIFY'; message: MascotMessage }
    | { type: 'CLEAR_MESSAGE' };

export type MascotApi = {
    readonly state: MascotState;
    readonly message: MascotMessage | null;
    readonly celebrate: () => void;
    readonly sleep: () => void;
    readonly wake: () => void;
    readonly setState: (state: MascotState) => void;
    readonly notify: (
        text: string,
        tone?: MascotTone,
        durationMs?: number,
    ) => void;
    readonly clearMessage: () => void;
};
