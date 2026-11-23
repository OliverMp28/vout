/**
 * Petición JSON al propio portal fuera de Inertia, para guardar algo sin
 * recargar la página (preferencias de la página de juego, por ejemplo: una
 * visita de Inertia volvería a pasar por `PlayController` y emitiría otro
 * token de sesión).
 *
 * Mismo patrón que la renovación del token (`use-game-session.ts`): CSRF por
 * cabecera desde el meta (`lib/csrf.ts`) y cookies del propio origen. Con
 * `keepalive`, termina aunque el usuario cambie de página justo después.
 */

import { csrfToken } from '@/lib/csrf';

export type JsonMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Devuelve si el servidor aceptó la petición (2xx). Nunca lanza. */
export async function sendJson(
    url: string,
    method: JsonMethod,
    body: Record<string, unknown>,
): Promise<boolean> {
    try {
        const response = await fetch(url, {
            method,
            credentials: 'same-origin',
            keepalive: true,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': csrfToken(),
            },
            body: JSON.stringify(body),
        });

        return response.ok;
    } catch {
        return false;
    }
}
