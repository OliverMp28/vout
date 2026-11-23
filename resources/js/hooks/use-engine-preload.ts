/**
 * Precarga del control facial en las páginas: qué toca según el usuario y la
 * página (`lib/mediapipe/preload-policy.ts`) y cuándo hacerlo (con la pestaña
 * visible y el navegador libre, `lib/mediapipe/idle-task.ts`).
 *
 * No importa el motor ni el worker: las páginas que solo descargan ficheros
 * (ficha del juego, panel) no cargan su código. Cuando la ficha tiene que
 * preparar el motor (quien juega con la cámara), lo trae aparte con un
 * `import()` diferido (`useDeferredEngineWarmup`).
 */

import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

import { WARMUP_IDLE_TIMEOUT_MS } from '@/lib/mediapipe/constants';
import { runWhenIdle } from '@/lib/mediapipe/idle-task';
import {
    decidePreload,
    facialControlIntent,
    readDeviceHints,
} from '@/lib/mediapipe/preload-policy';
import type {
    FacialControlIntent,
    PreloadContext,
    PreloadDecision,
} from '@/lib/mediapipe/preload-policy';
import { resolveRuntimeAssets } from '@/lib/mediapipe/runtime-assets';
import {
    prefetchRuntimeAssets,
    runtimePrefetchUrls,
} from '@/lib/mediapipe/runtime-prefetch';

type PreloadDecisionOptions = {
    /**
     * Si tiene perfil de gestos (en la página de juego, sin él no se puede
     * activar). Donde no se sabe, true.
     */
    hasProfile?: boolean;
    /**
     * La intención, si la página la sabe mejor que los ajustes guardados (el
     * asistente se muestra al encender el control facial, aún sin guardar).
     */
    intent?: FacialControlIntent;
    /** Si el juego de la página recibe los controles de Vout. */
    gameSupportsFacialControl?: boolean;
};

/** Qué se adelanta en esta página para el usuario actual. */
export function usePreloadDecision(
    context: PreloadContext,
    {
        hasProfile = true,
        intent,
        gameSupportsFacialControl = true,
    }: PreloadDecisionOptions = {},
): PreloadDecision {
    const { auth } = usePage().props;
    // Las pistas del equipo no cambian durante la visita.
    const [device] = useState(readDeviceHints);

    return decidePreload({
        intent: intent ?? facialControlIntent(auth?.user?.settings),
        context,
        hasProfile,
        gameSupportsFacialControl,
        device,
    });
}

/**
 * Con `decision === 'warm'`, prepara el motor sin cámara en cuanto `ready`
 * (la página ya cargó lo suyo) y el navegador esté libre.
 */
export function useEngineWarmup(
    decision: PreloadDecision,
    ready: boolean,
    prewarm: () => void,
): void {
    useEffect(() => {
        if (decision !== 'warm' || !ready) {
            return;
        }

        return runWhenIdle(prewarm, WARMUP_IDLE_TIMEOUT_MS);
    }, [decision, ready, prewarm]);
}

/**
 * Con `decision === 'prefetch'`, descarga los ficheros de MediaPipe a la caché
 * del navegador cuando esté libre.
 */
export function useRuntimePrefetch(decision: PreloadDecision): void {
    useEffect(() => {
        if (decision !== 'prefetch') {
            return;
        }

        return runWhenIdle(
            () =>
                prefetchRuntimeAssets(
                    runtimePrefetchUrls(resolveRuntimeAssets()),
                ),
            WARMUP_IDLE_TIMEOUT_MS,
        );
    }, [decision]);
}

/**
 * Como `useEngineWarmup`, para páginas que no cargan el motor (la ficha del
 * juego): con `decision === 'warm'` lo trae con un `import()` diferido y lo
 * prepara sin cámara. Queda en caliente `RUNTIME_KEEP_WARM_MS`, de sobra
 * para pulsar "Jugar".
 */
export function useDeferredEngineWarmup(decision: PreloadDecision): void {
    useEffect(() => {
        if (decision !== 'warm') {
            return;
        }

        return runWhenIdle(() => {
            void import('@/lib/mediapipe/shared-runtime').then(
                ({ sharedRuntimeHost }) => sharedRuntimeHost.prewarm(),
            );
        }, WARMUP_IDLE_TIMEOUT_MS);
    }, [decision]);
}
