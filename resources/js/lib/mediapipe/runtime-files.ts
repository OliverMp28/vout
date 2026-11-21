/**
 * Ficheros del paquete `@mediapipe/tasks-vision` que descarga el worker.
 *
 * Lo comparten `runtime-assets.ts` (navegador) y `vite.config.ts`: en
 * desarrollo, un middleware del dev server los sirve tal cual desde
 * `node_modules` bajo `MEDIAPIPE_DEV_RUNTIME_PATH`. Si los sirviera Vite como
 * módulos, los transformaría (inyecta imports de `/@vite/client`, que no
 * funcionan en un worker, y rompe el cargador del WASM, que no es un módulo).
 */

export const MEDIAPIPE_DEV_RUNTIME_PATH = '/__mediapipe-runtime/';

/** Nombre público → ruta dentro de `node_modules/@mediapipe/tasks-vision`. */
export const MEDIAPIPE_RUNTIME_FILES = {
    'vision_bundle.mjs': 'vision_bundle.mjs',
    'vision_wasm_internal.js': 'wasm/vision_wasm_internal.js',
    'vision_wasm_internal.wasm': 'wasm/vision_wasm_internal.wasm',
    'vision_wasm_nosimd_internal.js': 'wasm/vision_wasm_nosimd_internal.js',
    'vision_wasm_nosimd_internal.wasm': 'wasm/vision_wasm_nosimd_internal.wasm',
} as const;

export type MediaPipeRuntimeFile = keyof typeof MEDIAPIPE_RUNTIME_FILES;
