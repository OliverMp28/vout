/**
 * El host del motor de la aplicación: uno para todas las páginas.
 *
 * Es un módulo, así que vive mientras la pestaña no se recargue y sobrevive
 * a la navegación de Inertia: el motor cargado en la página de un juego
 * sigue en caliente al volver al catálogo y entrar en otro (ver
 * `engine-runtime.ts`).
 *
 * Solo lo importan las páginas que usan el motor: el worker va inlineado en
 * este grafo y no debe llegar al bundle de las demás.
 */

import { ENGINE_INIT_TIMEOUT_MS, RUNTIME_KEEP_WARM_MS } from './constants';
import { RuntimeHost } from './engine-runtime';
import { createGestureWorker } from './gesture-worker-factory';
import { MEDIAPIPE_VERSION, resolveRuntimeAssets } from './runtime-assets';

export const sharedRuntimeHost = new RuntimeHost({
    createWorker: createGestureWorker,
    resolveAssets: () => resolveRuntimeAssets(),
    mediapipeVersion: MEDIAPIPE_VERSION,
    initTimeoutMs: ENGINE_INIT_TIMEOUT_MS,
    keepWarmMs: RUNTIME_KEEP_WARM_MS,
});

// En desarrollo, al recargar este módulo no debe quedar un worker huérfano.
if (import.meta.hot) {
    import.meta.hot.dispose(() => sharedRuntimeHost.disposeAll());
}
