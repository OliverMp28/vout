<?php

use function Pest\Laravel\get;

it('sirve la guía de integración en markdown', function (): void {
    get(route('developers.docs', ['slug' => 'integration-guide']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('developers/docs', false)
            ->where('slug', 'integration-guide')
            ->where('locale', app()->getLocale())
            ->has('markdown')
            ->has('available_locales'));
});

it('responde 404 a slugs fuera de la whitelist', function (): void {
    get(route('developers.docs', ['slug' => 'desconocida']))->assertNotFound();
});

it('no permite path traversal mediante el parámetro slug', function (): void {
    // La restricción `where('slug', '[a-z0-9-]+')` convierte estas peticiones
    // en no-match y devuelve 404 antes de llegar al controlador.
    get('/developers/docs/..%2F..%2Fconfig%2Fapp')->assertNotFound();
    get('/developers/docs/../secret')->assertNotFound();
});
