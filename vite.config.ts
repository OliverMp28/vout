import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createReadStream, readFileSync } from 'node:fs';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

import {
    MEDIAPIPE_DEV_RUNTIME_PATH,
    MEDIAPIPE_RUNTIME_FILES,
} from './resources/js/lib/mediapipe/runtime-files';

/**
 * Versión de MediaPipe que se sirve (la de `bun.lock`). Se muestra en la
 * telemetría del motor para saber con qué versión se midió.
 */
const mediapipeVersion: string = JSON.parse(
    readFileSync('node_modules/@mediapipe/tasks-vision/package.json', 'utf8'),
).version;

/**
 * En desarrollo sirve tal cual (sin pasar por las transformaciones de Vite)
 * el bundle y los WASM de MediaPipe que carga el worker de gestos. En el build
 * se emiten como assets (`resources/js/lib/mediapipe/runtime-assets.ts`).
 */
function mediapipeDevRuntime(): Plugin {
    return {
        name: 'vout:mediapipe-dev-runtime',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(
                MEDIAPIPE_DEV_RUNTIME_PATH,
                (req, res, next) => {
                    const name = (req.url ?? '')
                        .split('?')[0]
                        .replace(/^\//, '');
                    const file =
                        MEDIAPIPE_RUNTIME_FILES[
                            name as keyof typeof MEDIAPIPE_RUNTIME_FILES
                        ];

                    if (file === undefined) {
                        next();

                        return;
                    }

                    res.setHeader(
                        'Content-Type',
                        file.endsWith('.wasm')
                            ? 'application/wasm'
                            : 'text/javascript; charset=utf-8',
                    );
                    // La página (Laravel, puerto 80) y el dev server son orígenes
                    // distintos: el worker los descarga con CORS.
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    createReadStream(
                        `node_modules/@mediapipe/tasks-vision/${file}`,
                    ).pipe(res);
                },
            );
        },
    };
}

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
        mediapipeDevRuntime(),
    ],
    define: {
        __MEDIAPIPE_VERSION__: JSON.stringify(mediapipeVersion),
    },
    build: {
        rollupOptions: {
            output: {
                // El bundle de MediaPipe llega como `.mjs` (`runtime-assets.ts`).
                // Se publica como `.js` para que cualquier servidor lo sirva
                // con un tipo MIME de JavaScript: el worker lo importa como
                // módulo y el navegador rechaza otro tipo.
                assetFileNames: (asset) =>
                    asset.names.some((name) => name.endsWith('.mjs'))
                        ? 'assets/[name]-[hash].js'
                        : 'assets/[name]-[hash][extname]',
            },
        },
    },
    esbuild: {
        jsx: 'automatic',
    },
});
