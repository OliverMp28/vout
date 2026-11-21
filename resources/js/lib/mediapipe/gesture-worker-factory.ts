/**
 * Crea el Web Worker de detección de gestos, en desarrollo y en producción.
 *
 * **Producción:** `?worker&inline` empaqueta el worker como base64 y Vite crea
 * un Blob URL del mismo origen que la página.
 *
 * **Desarrollo:** el dev server de Vite (puerto 5173) y Laravel (puerto 80)
 * son orígenes distintos y `new Worker(url)` exige el mismo origen. Se crea un
 * Blob URL del mismo origen cuyo contenido importa el worker real del dev
 * server (recomendado por Vite, vitejs/vite#13680). El shim añade dos
 * polyfills:
 *
 *   1. `importScripts`: el WASM de MediaPipe carga su glue code con
 *      `importScripts()`, que un module worker no admite. Se reemplaza con XHR
 *      síncrono + eval, que conserva la semántica síncrona que espera.
 *   2. `self.import`: Vite lo emite para la carga dinámica de módulos en dev.
 */

// En dev este import genera un WorkerWrapper que nunca se instancia (se usa
// el shim); en build es el worker completo inlineado.
import InlinedGestureWorker from '../../workers/gesture-detector.worker.ts?worker&inline';
import type { WorkerInMessage, WorkerOutMessage } from './types';

/** Lo que el motor usa de un Worker (un Worker real lo cumple). */
export type GestureWorkerLike = {
    postMessage(message: WorkerInMessage, transfer?: Transferable[]): void;
    onmessage: ((event: MessageEvent<WorkerOutMessage>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    terminate(): void;
};

export type GestureWorkerHandle = {
    worker: GestureWorkerLike;
    /** Libera lo que no es el propio worker (el Blob URL del shim en dev). */
    dispose(): void;
};

export function createGestureWorker(): GestureWorkerHandle {
    if (!import.meta.env.DEV) {
        return { worker: new InlinedGestureWorker(), dispose: () => {} };
    }

    // `?worker_file&type=module` le dice al dev server que sirva el archivo
    // para un worker (sin preámbulo de HMR).
    const devWorkerUrl = new URL(
        '../../workers/gesture-detector.worker.ts?worker_file&type=module',
        import.meta.url,
    ).href;

    const shimSource = [
        `self.importScripts = (...urls) => {`,
        `  for (const url of urls) {`,
        `    const xhr = new XMLHttpRequest();`,
        `    xhr.open('GET', url, false);`,
        `    xhr.send();`,
        `    if (xhr.status >= 200 && xhr.status < 300) {`,
        `      (0, eval)(xhr.responseText);`,
        `    } else {`,
        `      throw new Error('importScripts failed: ' + url + ' status=' + xhr.status);`,
        `    }`,
        `  }`,
        `};`,
        `self.import = (url) => import(url);`,
        `import ${JSON.stringify(devWorkerUrl)};`,
    ].join('\n');

    const blobUrl = URL.createObjectURL(
        new Blob([shimSource], { type: 'application/javascript' }),
    );

    return {
        worker: new Worker(blobUrl, { type: 'module' }),
        dispose: () => URL.revokeObjectURL(blobUrl),
    };
}
