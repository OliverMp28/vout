/**
 * Si el usuario quiere ver su cámara (con los contornos de la cara) en la
 * página de juego. Apagado por defecto.
 *
 * Privacidad: como la elección de cámara (`camera-devices.ts`), vive solo en
 * memoria mientras dure la pestaña. No se escribe en cookies, `localStorage`
 * ni servidor, así que no añade nada a la política de cookies. Si algún día
 * se guarda con la cuenta, irá a `user_settings`.
 */

let showCameraInGame = false;

export function getShowCameraInGame(): boolean {
    return showCameraInGame;
}

export function setShowCameraInGame(value: boolean): void {
    showCameraInGame = value;
}
