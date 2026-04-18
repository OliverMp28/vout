<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Páginas legales públicas — Fase 5.
 *
 * Sirve los cuatro documentos legales del portal (Aviso Legal, Política de
 * Privacidad, Política de Cookies y Términos de Servicio) a partir de
 * archivos markdown con frontmatter YAML simple.
 *
 * Patrón reutilizado de `DevelopersLandingController::docs`:
 *   - Whitelist cerrada de slugs; el parámetro nunca se concatena a rutas.
 *   - Resolución de locale con fallback al primer idioma disponible.
 *   - Render vía `MarkdownView` del front (ya instalado en Fase 4.1).
 *
 * Además:
 *   - Acepta alias en inglés (`notice`, `privacy`, `cookies`, `terms`) porque
 *     si una guía externa linkea en inglés queremos que funcione sin romper.
 *   - Sustituye tokens `{{...}}` del markdown con valores de
 *     `config('vout.legal.*')` para no duplicar datos de identificación en
 *     cada archivo.
 */
class LegalController extends Controller
{
    /**
     * Mapa de slugs a títulos i18n y archivos por locale.
     *
     * @var array<string, array{title_key: string, files: array<string, string>}>
     */
    private const DOCUMENTS = [
        'aviso-legal' => [
            'title_key' => 'legal.documents.notice.title',
            'files' => [
                'es' => 'aviso-legal.es.md',
                'en' => 'aviso-legal.en.md',
            ],
        ],
        'privacidad' => [
            'title_key' => 'legal.documents.privacy.title',
            'files' => [
                'es' => 'privacidad.es.md',
                'en' => 'privacidad.en.md',
            ],
        ],
        'cookies' => [
            'title_key' => 'legal.documents.cookies.title',
            'files' => [
                'es' => 'cookies.es.md',
                'en' => 'cookies.en.md',
            ],
        ],
        'terminos' => [
            'title_key' => 'legal.documents.terms.title',
            'files' => [
                'es' => 'terminos.es.md',
                'en' => 'terminos.en.md',
            ],
        ],
    ];

    /**
     * Alias en inglés — redirigen al slug canónico para mantener URLs en español
     * pero permitir enlaces externos en inglés.
     *
     * @var array<string, string>
     */
    private const ALIASES = [
        'notice' => 'aviso-legal',
        'privacy' => 'privacidad',
        'terms' => 'terminos',
    ];

    /**
     * Muestra una página legal.
     */
    public function show(Request $request, string $slug): Response
    {
        if (array_key_exists($slug, self::ALIASES)) {
            $slug = self::ALIASES[$slug];
        }

        abort_unless(array_key_exists($slug, self::DOCUMENTS), 404);

        $document = self::DOCUMENTS[$slug];
        $locale = $this->resolveLocale($document['files']);
        $path = base_path('docs/legal/'.$document['files'][$locale]);

        abort_unless(is_file($path), 404);

        $raw = (string) file_get_contents($path);
        [$frontmatter, $markdown] = $this->parseFrontmatter($raw);

        return Inertia::render('legal/show', [
            'slug' => $slug,
            'title_key' => $document['title_key'],
            'markdown' => $this->substituteTokens($markdown),
            'version' => $frontmatter['version'] ?? null,
            'last_updated' => $frontmatter['last_updated'] ?? null,
            'locale' => $locale,
            'available_locales' => array_keys($document['files']),
            'documents' => $this->documentMenu(),
        ]);
    }

    /**
     * Índice de documentos para el sidebar/TOC de navegación entre páginas legales.
     *
     * @return array<int, array{slug: string, title_key: string}>
     */
    private function documentMenu(): array
    {
        return collect(self::DOCUMENTS)
            ->map(fn (array $doc, string $slug): array => [
                'slug' => $slug,
                'title_key' => $doc['title_key'],
            ])
            ->values()
            ->all();
    }

    /**
     * Resuelve el locale disponible para el documento. Si el locale activo
     * no está entre las claves del array `files`, cae al primero declarado.
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

    /**
     * Extrae el frontmatter YAML simple (pares clave: valor) del principio
     * del archivo markdown. Mantenemos un parser minimal para evitar depender
     * de symfony/yaml en runtime.
     *
     * @return array{0: array<string, string>, 1: string}
     */
    private function parseFrontmatter(string $raw): array
    {
        if (! str_starts_with($raw, "---\n") && ! str_starts_with($raw, "---\r\n")) {
            return [[], $raw];
        }

        $pattern = '/^---\r?\n(.*?)\r?\n---\r?\n?/s';
        if (preg_match($pattern, $raw, $matches) !== 1) {
            return [[], $raw];
        }

        $frontmatter = [];
        foreach (preg_split('/\r?\n/', $matches[1]) ?: [] as $line) {
            if (trim($line) === '') {
                continue;
            }

            if (preg_match('/^(?<key>[a-zA-Z0-9_-]+)\s*:\s*(?<value>.*)$/', $line, $kv) === 1) {
                $value = trim($kv['value']);
                // Tolera tanto "clave: valor" como 'clave: "valor"'.
                if (strlen($value) >= 2
                    && (($value[0] === '"' && $value[strlen($value) - 1] === '"')
                        || ($value[0] === "'" && $value[strlen($value) - 1] === "'"))) {
                    $value = substr($value, 1, -1);
                }
                $frontmatter[$kv['key']] = $value;
            }
        }

        $body = (string) preg_replace($pattern, '', $raw, 1);

        return [$frontmatter, ltrim($body)];
    }

    /**
     * Reemplaza los tokens `{{clave}}` del markdown por los valores de
     * `config('vout.legal.*')`. Centralizamos los datos del responsable
     * para no duplicarlos en los ocho archivos.
     */
    private function substituteTokens(string $markdown): string
    {
        $tokens = [
            '{{holder_name}}' => (string) config('vout.legal.holder_name'),
            '{{contact_email}}' => (string) config('vout.legal.contact_email'),
            '{{domain}}' => (string) config('vout.legal.domain'),
            '{{repo_url}}' => (string) config('vout.legal.repo_url'),
        ];

        return strtr($markdown, $tokens);
    }
}
