<?php

use App\Models\Game;

// -----------------------------------------------------------------------
// Portada pública: el destacado fijo (sin carrusel), cómo funcionan los
// gestos y las filas. Tiene que verse bien con juegos y sin ninguno (una
// instalación recién desplegada).
// -----------------------------------------------------------------------

test('la portada sin juegos lo dice y propone publicar uno', function () {
    $page = visit('/');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('#welcome-empty')
        ->assertMissing('#welcome-featured')
        ->assertVisible('#btn-welcome-explore');
});

test('la portada con juegos destaca uno y no rota sola', function () {
    $game = Game::factory()->featured()->create(['name' => 'Salto de Muelle', 'cover_image' => null, 'play_count' => 900]);
    Game::factory()->featured()->create(['cover_image' => null, 'play_count' => 10]);

    $page = visit('/');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('#welcome-featured')
        ->assertSeeIn('#welcome-featured-title', 'Salto de Muelle')
        ->assertMissing('#welcome-empty')
        ->assertPresent('[data-generated-cover="'.$game->slug.'"]');
});

test('la portada enseña la fila de juegos con gestos solo si los hay', function () {
    Game::factory()->featured()->create(['cover_image' => null]);

    visit('/')->assertMissing('#section-gestures');

    $gestureGame = Game::factory()->designedForFace()->create(['name' => 'Globo y Púas', 'cover_image' => null]);

    visit('/')
        ->assertVisible('#section-gestures')
        ->assertPresent('#section-gestures a[href$="/catalog/'.$gestureGame->slug.'"]');
});

test('las filas no repiten lo que ya está en destacados', function () {
    $lead = Game::factory()->featured()->create(['cover_image' => null, 'play_count' => 5000]);
    Game::factory()->count(2)->featured()->create(['cover_image' => null, 'play_count' => 4000]);
    $mostPlayed = Game::factory()->create(['cover_image' => null, 'play_count' => 900]);
    Game::factory()->count(4)->create(['cover_image' => null, 'play_count' => 100]);

    visit('/')
        ->assertNoJavaScriptErrors()
        ->assertVisible('#section-popular')
        ->assertPresent('#section-popular a[href$="/catalog/'.$mostPlayed->slug.'"]')
        ->assertMissing('#section-popular a[href$="/catalog/'.$lead->slug.'"]')
        ->assertMissing('#section-newest');
});
