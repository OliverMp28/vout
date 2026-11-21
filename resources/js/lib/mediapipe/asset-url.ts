/**
 * Convierte la URL de un recurso en absoluta respecto a la página.
 *
 * El worker de detección corre desde un Blob URL, sobre el que no se puede
 * resolver una ruta relativa como `/build/assets/…`: hay que dársela
 * completa.
 */
export function toAbsoluteUrl(url: string, base: string): string {
    return new URL(url, base).href;
}
