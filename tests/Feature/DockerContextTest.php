<?php

/*
 * La imagen de producción se construye con el contexto que deja pasar
 * `.dockerignore`. Las páginas legales y la guía de integración se leen de
 * `docs/` en cada petición: si no entran en la imagen, dan 404 en producción
 * aunque los tests (que corren sobre el repositorio) pasen.
 */

/**
 * Emula las reglas de `.dockerignore` que usa el proyecto: la última regla
 * que encaja gana, y una regla que encaja con un directorio padre cubre todo
 * lo que hay dentro.
 */
function excludedFromDockerContext(string $path): bool
{
    $rules = collect(file(base_path('.dockerignore'), FILE_IGNORE_NEW_LINES))
        ->map(fn (string $line): string => trim($line))
        ->reject(fn (string $line): bool => $line === '' || str_starts_with($line, '#'));

    $segments = explode('/', $path);
    $candidates = array_map(
        fn (int $length): string => implode('/', array_slice($segments, 0, $length)),
        range(1, count($segments)),
    );

    $excluded = false;

    foreach ($rules as $rule) {
        $negated = str_starts_with($rule, '!');
        $pattern = ltrim($negated ? substr($rule, 1) : $rule, '/');

        foreach ($candidates as $candidate) {
            if (fnmatch($pattern, $candidate, FNM_PATHNAME)) {
                $excluded = ! $negated;

                break;
            }
        }
    }

    return $excluded;
}

it('mete en la imagen los documentos que la app lee en producción', function (string $path): void {
    expect(file_exists(base_path($path)))->toBeTrue()
        ->and(excludedFromDockerContext($path))->toBeFalse();
})->with(fn (): array => [
    ...array_map(
        fn (string $file): string => 'docs/legal/'.basename($file),
        glob(dirname(__DIR__, 2).'/docs/legal/*.md'),
    ),
    'docs/integration-guide.md',
    'docs/integration-guide.en.md',
]);

it('deja fuera de la imagen el resto de docs/', function (): void {
    expect(excludedFromDockerContext('docs/roadmap.md'))->toBeTrue()
        ->and(excludedFromDockerContext('docs/planes/plan-6-mejoras.md'))->toBeTrue();
});
