import { useEffect, useId, useRef } from 'react';
import { registerContextSource } from '@/components/mascot/mascot-context-registry';
import type { MessageCandidate } from '@/types/mascot';

/**
 * Declara candidatos de tooltip contextuales para la página actual.
 *
 * Vou elegirá el candidato activo (`when === true`) de mayor `priority`
 * en el momento del tap — o, si el candidato tiene `auto: true`, puede
 * también mostrarlo proactivamente tras un pequeño delay al entrar en
 * la página (ver `vou.tsx`). Si ninguno aplica, hace fallback a un
 * saludo aleatorio.
 *
 * El hook se apoya en un registry singleton (ver
 * `mascot-context-registry.ts`) que vive fuera del árbol React, de modo
 * que funciona desde cualquier página sin requerir un `MascotProvider`
 * ancestor — las páginas se ejecutan antes de que su layout monte.
 *
 * Uso típico:
 *
 * ```tsx
 * useMascotContext([
 *     {
 *         id: 'resume',
 *         priority: 10,
 *         auto: true,
 *         when: continueGame !== null,
 *         text: t('mascot.context.dashboard.resume', {
 *             game: continueGame?.name ?? '',
 *         }),
 *     },
 * ]);
 * ```
 *
 * Internamente guarda los candidatos en un `ref` que se actualiza en un
 * efecto (React 19 no permite escribir en `ref.current` durante el
 * render) y registra un **único** getter estable. Esto evita
 * re-registros espurios cuando el array de candidatos cambia de
 * identidad, y garantiza que `when`/`text` reflejen el último estado
 * React en el momento en que Vou lee los candidatos.
 */
export function useMascotContext(candidates: readonly MessageCandidate[]): void {
    const sourceId = useId();
    const candidatesRef = useRef<readonly MessageCandidate[]>(candidates);

    useEffect(() => {
        candidatesRef.current = candidates;
    });

    useEffect(() => {
        return registerContextSource(sourceId, () => candidatesRef.current);
    }, [sourceId]);
}
