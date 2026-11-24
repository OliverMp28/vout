import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';
import { initializeTheme } from '@/hooks/use-appearance';
import { syncCsrfToken } from '@/lib/csrf';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Las letras pasan por Vite (nombre con hash y caché larga) para que
// app.blade.php pueda precargarlas con Vite::asset().
import.meta.glob('../fonts/**/*.woff2');

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <StrictMode>
                <App {...props} />
            </StrictMode>,
        );
    },
    progress: {
        // El cian de la señal (--signal-edge): se ve en claro y en oscuro.
        color: 'oklch(0.56 0.09 222)',
    },
});

// This will set light / dark mode on load...
initializeTheme();

syncCsrfToken();
