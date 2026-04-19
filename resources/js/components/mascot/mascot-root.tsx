import { usePage } from '@inertiajs/react';
import { Suspense, lazy } from 'react';
import type { Auth } from '@/types';

const Vou = lazy(() => import('./vou').then((m) => ({ default: m.Vou })));

const EXCLUDED_PATHS = ['/settings/appearance'];

/**
 * Puerta de entrada de la mascota en el layout del portal.
 *
 * Decide en tiempo de render si hay que montar (y por tanto descargar) el
 * bundle de `Vou`:
 * - Sólo si el usuario está autenticado y tiene `show_mascot` activado.
 * - Sólo si la ruta actual no es `/settings/appearance` — esa página
 *   renderiza su propio preview estático (`VouPreview`), tener una Vou
 *   viva encima sería redundante. El resto de tabs de `/settings/*` SÍ
 *   montan la mascota para que `notify()` + `celebrate()` del S6 den
 *   feedback visible al guardar el formulario.
 *
 * Si cualquiera de las condiciones falla, retorna `null` — React nunca
 * importa el chunk, el usuario no paga coste de descarga.
 */
export function MascotRoot() {
    const page = usePage();
    const auth = page.props.auth as Auth | undefined;
    const showMascot = auth?.user?.settings?.show_mascot ?? false;

    const currentPath = new URL(
        page.url,
        typeof window !== 'undefined'
            ? window.location.origin
            : 'http://localhost',
    ).pathname;

    const isExcluded = EXCLUDED_PATHS.includes(currentPath);

    if (!showMascot || isExcluded) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <Vou />
        </Suspense>
    );
}
