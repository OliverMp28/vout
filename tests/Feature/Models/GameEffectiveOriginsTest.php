<?php

use App\Models\Game;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── effectiveOrigins: siempre derivado de embed_url ─────────
//
// No existe columna `allowed_origins` en la BD. El origen de confianza
// para el handshake postMessage se extrae siempre del campo `embed_url`.
// Si en Fase 4 se añade FK `registered_app_id`, este accessor se extenderá.

it('deriva el origin desde embed_url', function () {
    $game = Game::factory()->create([
        'embed_url' => 'https://dino.vout.com/play',
    ]);

    expect($game->effective_origins)->toBe(['https://dino.vout.com']);
});

it('preserva el puerto en el origin derivado', function () {
    $game = Game::factory()->create([
        'embed_url' => 'http://localhost:8080/game',
    ]);

    expect($game->effective_origins)->toBe(['http://localhost:8080']);
});

it('funciona con rutas profundas en el embed_url', function () {
    $game = Game::factory()->create([
        'embed_url' => 'https://games.vout.com/play/astro-blaster?v=2',
    ]);

    expect($game->effective_origins)->toBe(['https://games.vout.com']);
});

// ─── effectiveOrigins: casos límite ──────────────────────────

it('devuelve array vacío si embed_url es null', function () {
    $game = Game::factory()->create(['embed_url' => null]);

    expect($game->effective_origins)->toBe([]);
});

it('devuelve array vacío si embed_url es una cadena vacía', function () {
    $game = Game::factory()->create(['embed_url' => '']);

    expect($game->effective_origins)->toBe([]);
});

it('devuelve array vacío si embed_url no tiene scheme o host válidos', function () {
    $game = Game::factory()->create(['embed_url' => 'not-a-valid-url']);

    expect($game->effective_origins)->toBe([]);
});
