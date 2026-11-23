/**
 * El permiso de cámara que tiene el portal en el navegador, sin pedirlo.
 *
 * El encendido automático solo actúa con el permiso ya dado ("Permitir
 * siempre"): nunca lanza el diálogo del navegador sin que el usuario pulse.
 *
 * - Chromium lo da de forma fiable. Con "Permitir esta vez", en la visita
 *   siguiente vuelve a `prompt`.
 * - Firefox solo dice `granted` si se eligió recordarlo; versiones antiguas
 *   lanzan `TypeError` con `'camera'`.
 * - Safari suele decir `prompt`.
 *
 * Sin DOM ni React: la API se inyecta.
 */

export type CameraPermission =
    'pending' | 'granted' | 'prompt' | 'denied' | 'unknown';

type PermissionStatusLike = {
    state: string;
    addEventListener?: (type: 'change', listener: () => void) => void;
    removeEventListener?: (type: 'change', listener: () => void) => void;
};

export type PermissionsLike = {
    query(descriptor: { name: string }): Promise<PermissionStatusLike>;
};

function normalize(state: string): CameraPermission {
    return state === 'granted' || state === 'prompt' || state === 'denied'
        ? state
        : 'unknown';
}

/**
 * Lee el permiso y avisa de cada cambio (`onChange` recibe primero el
 * estado inicial). Devuelve la función que deja de escuchar.
 */
export function watchCameraPermission(
    onChange: (permission: CameraPermission) => void,
    permissions: PermissionsLike | undefined = globalThis.navigator
        ?.permissions as PermissionsLike | undefined,
): () => void {
    let stopped = false;
    let unsubscribe = (): void => {};

    if (permissions === undefined || typeof permissions.query !== 'function') {
        onChange('unknown');

        return () => {};
    }

    let query: Promise<PermissionStatusLike>;

    try {
        query = permissions.query({ name: 'camera' });
    } catch {
        onChange('unknown');

        return () => {};
    }

    query.then(
        (status) => {
            if (stopped) {
                return;
            }

            onChange(normalize(status.state));

            const listener = (): void => onChange(normalize(status.state));
            status.addEventListener?.('change', listener);
            unsubscribe = () =>
                status.removeEventListener?.('change', listener);
        },
        () => {
            if (!stopped) {
                onChange('unknown');
            }
        },
    );

    return () => {
        stopped = true;
        unsubscribe();
    };
}
