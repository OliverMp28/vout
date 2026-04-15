<?php

namespace App\Http\Controllers\Developers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Developer Portal — landing pública y visor de documentación.
 *
 * Sirve la cara visible del portal para desarrolladores externos:
 *   - `/developers`                landing con CTAs e índice de guías.
 *   - `/developers/docs/{slug}`    visor de markdown con whitelist estricta.
 *
 * La whitelist previene path traversal: el parámetro `{slug}` nunca
 * se concatena a rutas de sistema; se usa como clave en un mapa cerrado.
 */
class DevelopersLandingController extends Controller
{
    /**
     * Guías disponibles. Claves = slugs expuestos en la URL.
     * Valores = títulos i18n-ables y archivos por locale.
     *
     * @var array<string, array{title_key: string, files: array<string, string>}>
     */
    private const GUIDES = [
        'integration-guide' => [
            'title_key' => 'developers.docs.integration_guide.title',
            'files' => [
                'es' => 'integration-guide.md',
                'en' => 'integration-guide.en.md',
            ],
        ],
    ];

    /**
     * Landing pública del Developer Portal.
     */
    public function show(Request $request): Response
    {
        return Inertia::render('developers/landing', [
            'is_authenticated' => $request->user() !== null,
            'guides' => collect(self::GUIDES)
                ->map(fn (array $guide, string $slug): array => [
                    'slug' => $slug,
                    'title_key' => $guide['title_key'],
                ])
                ->values()
                ->all(),
            'locale' => app()->getLocale(),
        ]);
    }

    /**
     * Visor de markdown con whitelist estricta.
     */
    public function docs(Request $request, string $slug): Response
    {
        abort_unless(array_key_exists($slug, self::GUIDES), 404);

        $guide = self::GUIDES[$slug];
        $locale = $this->resolveLocale($guide['files']);
        $file = $guide['files'][$locale];
        $path = base_path('docs/'.$file);

        abort_unless(is_file($path), 404);

        return Inertia::render('developers/docs', [
            'slug' => $slug,
            'title_key' => $guide['title_key'],
            'markdown' => (string) file_get_contents($path),
            'locale' => $locale,
            'available_locales' => array_keys($guide['files']),
        ]);
    }

    /**
     * Resuelve el locale del archivo a servir (fallback al primero disponible).
     *
     * @param  array<string, string>  $files
     */
    private function resolveLocale(array $files): string
    {
        $current = app()->getLocale();

        return array_key_exists($current, $files)
            ? $current
            : array_key_first($files);
    }
}
