<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Fondo y esquema de color antes de que cargue el CSS: los mismos valores que --background en app.css (un test lo comprueba) --}}
        <style>
            html {
                background-color: oklch(0.93 0.006 235);
                color-scheme: light;
            }

            html.dark {
                background-color: oklch(0.19 0.008 245);
                color-scheme: dark;
            }
        </style>

        <meta name="theme-color" content="#e4e9eb" media="(prefers-color-scheme: light)">
        <meta name="theme-color" content="#111417" media="(prefers-color-scheme: dark)">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

        {{-- La letra de lectura se pide antes que el CSS para que el texto no salte al cargar --}}
        <link rel="preload" href="{{ Vite::asset('resources/fonts/atkinson-hyperlegible-next/latin-wght-normal.woff2') }}" as="font" type="font/woff2" crossorigin>

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
