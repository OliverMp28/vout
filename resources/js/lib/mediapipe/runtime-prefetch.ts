/**
 * Descarga por adelantado los ficheros de MediaPipe a la caché del navegador
 * (`<link rel="prefetch">`), sin crear el worker: solo red, a baja prioridad.
 *
 * Se usa en las páginas desde las que se entra a jugar cuando
 * `preload-policy.ts` lo decide. Así, al llegar a la página de juego, el
 * motor se prepara desde la caché. Con los ficheros ya en caché (tienen hash
 * en el nombre) el navegador no vuelve a pedirlos.
 *
 * Sin dependencias de `runtime-assets.ts` (usa `?url` de Vite): recibe las
 * URLs y el documento.
 */

import type { MediaPipeRuntimeAssets } from './types';

/** Marca de los `<link>` que añade este módulo. */
export const PREFETCH_ATTRIBUTE = 'data-mediapipe-prefetch';

/**
 * Lo que necesita el worker para cargar el motor: el bundle, el WASM con SIMD
 * (el que usan todos los navegadores actuales) con su cargador, y el modelo.
 */
export function runtimePrefetchUrls(assets: MediaPipeRuntimeAssets): string[] {
    return [
        assets.visionBundleUrl,
        assets.wasm.simd.wasmLoaderPath,
        assets.wasm.simd.wasmBinaryPath,
        assets.modelUrl,
    ];
}

/** Lo que este módulo usa del documento. */
export type PrefetchDocument = {
    head: { appendChild(node: HTMLLinkElement): unknown };
    createElement(tagName: 'link'): HTMLLinkElement;
    querySelectorAll(selectors: string): ArrayLike<{ href: string }>;
};

/**
 * Añade un `<link rel="prefetch">` por cada URL que no tenga ya uno.
 *
 * @returns Cuántos se añadieron.
 */
export function prefetchRuntimeAssets(
    urls: readonly string[],
    doc: PrefetchDocument = document,
): number {
    const existing = new Set(
        Array.from(doc.querySelectorAll(`link[${PREFETCH_ATTRIBUTE}]`)).map(
            (link) => link.href,
        ),
    );
    let added = 0;

    for (const url of urls) {
        if (existing.has(url)) {
            continue;
        }

        const link = doc.createElement('link');

        link.rel = 'prefetch';
        link.href = url;
        // Como lo pedirá el worker (CORS, cookies solo del mismo origen):
        // así la respuesta en caché le sirve también en desarrollo, donde
        // los ficheros vienen del dev server de Vite.
        link.crossOrigin = 'anonymous';
        link.setAttribute(PREFETCH_ATTRIBUTE, '');
        doc.head.appendChild(link);
        existing.add(url);
        added++;
    }

    return added;
}
