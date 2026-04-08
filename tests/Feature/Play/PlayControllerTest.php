<?php

use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// Registrar el cliente personal de Passport antes de cada test.
// PlayController llama a $user->createToken(), que requiere un cliente personal
// en la BD. Con RefreshDatabase los clientes se limpian entre tests.
beforeEach(fn () => test()->setUpPassport());

// ─── Acceso y autenticación ───────────────────────────────────

it('redirige al login si el usuario no está autenticado', function () {
    $game = Game::factory()->create(['is_active' => true]);

    $this->get(route('play.show', $game))
        ->assertRedirect(route('login'));
});

// ─── Respuesta correcta ───────────────────────────────────────

it('devuelve 200 y renderiza el componente play/game', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('play/game', false));
});

it('devuelve 404 para juegos inactivos', function () {
    $user = User::factory()->create();
    $game = Game::factory()->inactive()->create();

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertNotFound();
});

it('devuelve 404 para slugs inexistentes', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('play.show', 'slug-que-no-existe'))
        ->assertNotFound();
});

// ─── Props Inertia: datos del juego ──────────────────────────

it('incluye las props correctas del juego en la respuesta Inertia', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create([
        'is_active' => true,
        'embed_url' => 'https://dino.vout.com/play',
        'description' => 'Un juego de prueba.',
    ]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('game')
            ->where('game.slug', $game->slug)
            ->where('game.name', $game->name)
            ->where('game.embed_url', $game->embed_url)
            ->where('game.description', $game->description)
        );
});

it('incluye effective_origins derivado de embed_url', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create([
        'is_active' => true,
        'embed_url' => 'https://dino.vout.com/play',
    ]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('game.effective_origins', ['https://dino.vout.com'])
        );
});

// ─── Props Inertia: access token ─────────────────────────────

it('incluye un access token para el usuario autenticado', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('accessToken')
            ->whereType('accessToken', 'string')
        );
});

// ─── Props Inertia: configuración de gestos ──────────────────

it('incluye activeGestureConfig null si el usuario no tiene configuración activa', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('activeGestureConfig', null)
        );
});

it('incluye activeGestureConfig con los datos correctos si el usuario tiene una activa', function () {
    $user = User::factory()->create();
    $config = GestureConfig::factory()->for($user)->create(['is_active' => true]);
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('activeGestureConfig')
            ->where('activeGestureConfig.id', $config->id)
        );
});

it('solo devuelve la config activa cuando el usuario tiene varias', function () {
    $user = User::factory()->create();
    $inactive = GestureConfig::factory()->for($user)->create(['is_active' => false]);
    $active = GestureConfig::factory()->for($user)->create(['is_active' => true]);
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('activeGestureConfig.id', $active->id)
        );
});
