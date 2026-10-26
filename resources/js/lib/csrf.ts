import { router } from '@inertiajs/react';

/**
 * Token CSRF de la sesión, enviado siempre en la cabecera `X-CSRF-TOKEN`.
 *
 * No nos apoyamos en la cookie `XSRF-TOKEN`: en producción conviven otras
 * apps bajo `.vout.cloud` que emiten una cookie con el mismo nombre para todo
 * el dominio, y el navegador nos la manda junto a la nuestra. Laravel mira
 * `X-CSRF-TOKEN` antes que `X-XSRF-TOKEN`, así que la cookie ajena deja de
 * influir.
 *
 * La fuente es `<meta name="csrf-token">` del layout Blade. Como Inertia no
 * recarga el documento, cada respuesta trae el token vigente en la prop
 * compartida `csrfToken` (cambia al cerrar sesión) y lo copiamos al meta.
 */
function csrfMeta(): HTMLMetaElement | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
}

export function csrfToken(): string {
    return csrfMeta()?.content ?? '';
}

export function syncCsrfToken(): void {
    router.on('before', (event) => {
        event.detail.visit.headers = {
            ...event.detail.visit.headers,
            'X-CSRF-TOKEN': csrfToken(),
        };
    });

    router.on('success', (event) => {
        const token = event.detail.page.props.csrfToken;
        const meta = csrfMeta();

        if (typeof token === 'string' && meta !== null) {
            meta.content = token;
        }
    });
}
