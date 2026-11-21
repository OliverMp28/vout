<?php

use App\Models\Game;

// -----------------------------------------------------------------------
// Portada pública. Sin juegos destacados se muestra el hero de respaldo
// en lugar del carrusel: es lo que ve una instalación recién desplegada,
// así que tiene que renderizar sin errores de JavaScript.
// -----------------------------------------------------------------------

test('la portada sin juegos destacados muestra el hero de respaldo', function () {
    Game::factory()->create(['is_featured' => false]);

    $page = visit('/');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('#btn-welcome-explore');
});

test('la portada con juegos destacados muestra el carrusel y no el hero de respaldo', function () {
    Game::factory()->featured()->create();

    $page = visit('/');

    $page->assertNoJavaScriptErrors()
        ->assertMissing('#btn-welcome-explore');
});
