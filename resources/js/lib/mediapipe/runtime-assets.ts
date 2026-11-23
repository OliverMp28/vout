/**
 * Ficheros de MediaPipe que descarga el worker, servidos por Vout.
 *
 * **Build:** Vite copia el bundle de `@mediapipe/tasks-vision`, sus WASM y el
 * modelo (`public/models/face_landmarker.task`) a `public/build/assets` con
 * un hash en el nombre (`?url`): mismo origen que la página, caché larga sin
 * revalidar y ningún tercero (antes venían de jsDelivr y el modelo de Google
 * Cloud Storage). La versión es la que fija `bun.lock`. Laravel no usa
 * `publicDir` de Vite, así que el modelo se importa como cualquier otro
 * fichero.
 *
 * **Desarrollo:** el bundle y los WASM los sirve sin transformar un
 * middleware del dev server (`vite.config.ts`, ver `runtime-files.ts`); el
 * modelo, el propio dev server.
 *
 * `VITE_MEDIAPIPE_MODEL_PATH` permite usar otro modelo.
 *
 * No se usa `FilesetResolver.forVisionTasks(dir)` porque necesita los
 * ficheros en un directorio con sus nombres originales; el worker recibe
 * cada URL por separado y elige SIMD o no SIMD.
 */

import simdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import simdBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import nosimdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';
import nosimdBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';
import visionBundleUrl from '@mediapipe/tasks-vision?url';

import bundledModelUrl from '../../../../public/models/face_landmarker.task?url';
import { toAbsoluteUrl } from './asset-url';
import { MEDIAPIPE_DEV_RUNTIME_PATH } from './runtime-files';
import type { MediaPipeRuntimeFile } from './runtime-files';
import type { MediaPipeRuntimeAssets } from './types';

/** Versión de `@mediapipe/tasks-vision` incluida en el build. */
export const MEDIAPIPE_VERSION: string = __MEDIAPIPE_VERSION__;

const BUILD_URLS: Record<MediaPipeRuntimeFile, string> = {
    'vision_bundle.mjs': visionBundleUrl,
    'vision_wasm_internal.js': simdLoaderUrl,
    'vision_wasm_internal.wasm': simdBinaryUrl,
    'vision_wasm_nosimd_internal.js': nosimdLoaderUrl,
    'vision_wasm_nosimd_internal.wasm': nosimdBinaryUrl,
};

/** URL de un fichero del runtime, ya absoluta. */
function runtimeUrl(file: MediaPipeRuntimeFile, base: string): string {
    if (import.meta.env.DEV) {
        // `import.meta.url` es la de este módulo en el dev server de Vite.
        return new URL(`${MEDIAPIPE_DEV_RUNTIME_PATH}${file}`, import.meta.url)
            .href;
    }

    return toAbsoluteUrl(BUILD_URLS[file], base);
}

/** URL del modelo, ya absoluta. */
function modelUrl(base: string): string {
    const override = import.meta.env.VITE_MEDIAPIPE_MODEL_PATH;

    if (override) {
        return toAbsoluteUrl(override, base);
    }

    // En desarrollo lo sirve el dev server de Vite, no la página.
    return toAbsoluteUrl(
        bundledModelUrl,
        import.meta.env.DEV ? import.meta.url : base,
    );
}

/** URLs absolutas de todo lo que necesita el worker. */
export function resolveRuntimeAssets(
    base: string = document.baseURI,
): MediaPipeRuntimeAssets {
    return {
        visionBundleUrl: runtimeUrl('vision_bundle.mjs', base),
        wasm: {
            simd: {
                wasmLoaderPath: runtimeUrl('vision_wasm_internal.js', base),
                wasmBinaryPath: runtimeUrl('vision_wasm_internal.wasm', base),
            },
            nosimd: {
                wasmLoaderPath: runtimeUrl(
                    'vision_wasm_nosimd_internal.js',
                    base,
                ),
                wasmBinaryPath: runtimeUrl(
                    'vision_wasm_nosimd_internal.wasm',
                    base,
                ),
            },
        },
        modelUrl: modelUrl(base),
    };
}
