import { useEffect, useRef } from 'react';
import { useMascot } from './use-mascot';
import { useTranslation } from './use-translation';

export type OnboardingGuideStep = {
    readonly key: 'explore' | 'gestures' | 'profile';
    readonly done: boolean;
};

export type OnboardingGuideState = {
    readonly show: boolean;
    readonly steps: readonly OnboardingGuideStep[];
};

/**
 * Sincroniza el estado de onboarding del dashboard con el modo `guide`
 * de la mascota Vou (S8).
 *
 * - Mientras `onboarding.show` sea `true` y queden pasos pendientes, la
 *   guía queda activa apuntando al primero pendiente.
 * - Cuando un paso pasa de `done:false` a `done:true` dispara `celebrate()`.
 * - Al completar el último paso muestra un mensaje de cierre por el canal
 *   de notificación y cierra la guía.
 * - Si el usuario descarta el hero (`show:false`) sin completar, la guía
 *   se cierra silenciosamente.
 *
 * En el primer render los pasos que ya venían marcados como `done`
 * **no** disparan celebración — sólo las transiciones observadas durante
 * la sesión actual. Esto evita que un usuario con perfil ya completo vea
 * un saltito por algo que hizo hace días.
 */
export function useOnboardingGuide(onboarding: OnboardingGuideState): void {
    const { guide, celebrate, notify } = useMascot();
    const { t } = useTranslation();

    const prevStepsRef = useRef<Map<string, boolean>>(new Map());
    const completionCelebratedRef = useRef(false);

    useEffect(() => {
        if (!onboarding.show) {
            guide(null);
            prevStepsRef.current = new Map();
            completionCelebratedRef.current = false;
            return;
        }

        const prev = prevStepsRef.current;
        const next = new Map<string, boolean>();
        let justCompletedCount = 0;
        for (const step of onboarding.steps) {
            next.set(step.key, step.done);
            if (prev.get(step.key) === false && step.done === true) {
                justCompletedCount += 1;
            }
        }

        const allDone = onboarding.steps.every((s) => s.done);
        const hadPending =
            prev.size > 0 &&
            onboarding.steps.some((s) => prev.get(s.key) === false);

        if (allDone) {
            if (!completionCelebratedRef.current && hadPending) {
                celebrate();
                notify(t('mascot.guide.complete'), 'success');
                completionCelebratedRef.current = true;
            }
            guide(null);
            prevStepsRef.current = next;
            return;
        }

        if (justCompletedCount > 0) {
            celebrate();
        }

        const guideSteps = onboarding.steps.map((step) => ({
            key: step.key,
            text: t(`mascot.guide.step.${step.key}`),
            done: step.done,
        }));
        const nextIndex = guideSteps.findIndex((s) => !s.done);
        guide(guideSteps, nextIndex === -1 ? 0 : nextIndex);

        prevStepsRef.current = next;
    }, [onboarding, guide, celebrate, notify, t]);

    // Cleanup al desmontar el dashboard (navegación SPA): si la guía sigue
    // activa se cierra para que no contamine otras rutas.
    useEffect(() => {
        return () => {
            guide(null);
        };
    }, [guide]);
}
