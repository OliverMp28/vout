import type { MascotContextMessage, MessageCandidate } from '@/types/mascot';

/**
 * Registry de candidatos contextuales para el tap de Vou.
 *
 * Este módulo vive **fuera del árbol React** a propósito:
 *
 * - Las páginas declaran candidatos vía `useMascotContext()`, que puede
 *   invocarse antes de que cualquier layout (y por tanto cualquier
 *   Provider) haya montado. Usar un Context React aquí obligaría a un
 *   ancestor global, pero `MascotProvider` depende de `usePage()` de
 *   Inertia — y `usePage()` solo funciona dentro del `<App>` de Inertia,
 *   que a su vez recibe su contexto en runtime. Ponerlo por encima rompe
 *   ambas cosas.
 *
 * - Al estar fuera de React, el registro sobrevive a navegaciones SPA
 *   sin re-inicializar su estado ni disparar re-renders.
 *
 * Las fuentes se guardan como **getters**, no valores, para que el hook
 * consumidor pueda devolver siempre los candidatos recientes sin
 * re-registrar en cada render (ver `use-mascot-context.ts`).
 */
const sources = new Map<string, () => readonly MessageCandidate[]>();

export function registerContextSource(
    sourceId: string,
    getter: () => readonly MessageCandidate[],
): () => void {
    sources.set(sourceId, getter);
    return () => {
        sources.delete(sourceId);
    };
}

type PickOptions = {
    /**
     * Si es `true`, sólo se consideran candidatos con `auto: true` — usado
     * por Vou para el auto-show proactivo al entrar en la ruta. Sin la
     * opción, se consideran todos (modo tap).
     */
    readonly autoOnly?: boolean;
};

export function pickContextMessage(
    options: PickOptions = {},
): MascotContextMessage | null {
    const active: MessageCandidate[] = [];
    sources.forEach((getter) => {
        for (const candidate of getter()) {
            if (!candidate.when) {
                continue;
            }
            if (options.autoOnly && !candidate.auto) {
                continue;
            }
            active.push(candidate);
        }
    });
    if (active.length === 0) {
        return null;
    }
    // Array.sort es estable en motores modernos: empates respetan el
    // orden de inserción de las fuentes, lo que da un fallback razonable.
    active.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const winner = active[0];
    return { id: winner.id, text: winner.text, tone: winner.tone ?? 'info' };
}

/**
 * Solo expuesto para tests — permite limpiar el registry entre escenarios
 * sin depender del ciclo de vida React. No usar en código de aplicación.
 */
export function __resetContextRegistry(): void {
    sources.clear();
}
