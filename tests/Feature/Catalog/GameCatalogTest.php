<?php

use App\Models\Category;
use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Acceso público ───────────────────────────────────────────

it('el catálogo es accesible sin autenticación', function () {
    $this->get(route('catalog.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('catalog/index'));
});

it('el catálogo muestra solo juegos activos', function () {
    Game::factory()->count(3)->create(['is_active' => true]);
    Game::factory()->count(2)->inactive()->create();

    $this->get(route('catalog.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('games.data', 3));
});

// ─── Filtros ──────────────────────────────────────────────────

it('filtra por categoría correctamente', function () {
    $puzzle = Category::factory()->create(['slug' => 'puzzle']);
    $action = Category::factory()->create(['slug' => 'accion']);

    $puzzleGame = Game::factory()->create(['name' => 'Puzzle Game']);
    $actionGame = Game::factory()->create(['name' => 'Action Game']);

    $puzzleGame->categories()->attach($puzzle);
    $actionGame->categories()->attach($action);

    $this->get(route('catalog.index', ['categories' => ['puzzle']]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('games.data', 1)
            ->where('games.data.0.name', 'Puzzle Game')
        );
});

it('filtra con lógica OR entre múltiples categorías', function () {
    $puzzle = Category::factory()->create(['slug' => 'puzzle']);
    $action = Category::factory()->create(['slug' => 'accion']);
    $sport = Category::factory()->create(['slug' => 'deportes']);

    $puzzleGame = Game::factory()->create();
    $actionGame = Game::factory()->create();
    $sportGame = Game::factory()->create();

    $puzzleGame->categories()->attach($puzzle);
    $actionGame->categories()->attach($action);
    $sportGame->categories()->attach($sport);

    $this->get(route('catalog.index', ['categories' => ['puzzle', 'accion']]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('games.data', 2));
});

it('busca juegos por término en el nombre', function () {
    Game::factory()->create(['name' => 'Retro Invaders', 'description' => 'A classic.']);
    Game::factory()->create(['name' => 'Bubble Pop', 'description' => 'Match bubbles.']);

    $this->get(route('catalog.index', ['search' => 'retro']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('games.data', 1)
            ->where('games.data.0.name', 'Retro Invaders')
        );
});

it('ordena por popular (play_count desc)', function () {
    Game::factory()->create(['name' => 'Poco Jugado', 'play_count' => 100]);
    Game::factory()->create(['name' => 'Muy Jugado', 'play_count' => 9999]);

    $this->get(route('catalog.index', ['sort' => 'popular']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('games.data.0.name', 'Muy Jugado'));
});

it('ordena por newest (release_date desc)', function () {
    Game::factory()->create(['name' => 'Antiguo', 'release_date' => '2022-01-01']);
    Game::factory()->create(['name' => 'Reciente', 'release_date' => '2024-06-15']);

    $this->get(route('catalog.index', ['sort' => 'newest']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('games.data.0.name', 'Reciente'));
});

it('ordena por alphabetical (A-Z)', function () {
    Game::factory()->create(['name' => 'Zebra Rush']);
    Game::factory()->create(['name' => 'Alpha Run']);

    $this->get(route('catalog.index', ['sort' => 'alphabetical']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('games.data.0.name', 'Alpha Run'));
});

// ─── Datos según autenticación ────────────────────────────────

it('guest no recibe user_interaction en los juegos', function () {
    Game::factory()->create();

    $this->get(route('catalog.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->missing('games.data.0.user_interaction'));
});

it('usuario autenticado con interacción recibe user_interaction', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $user->games()->attach($game, [
        'is_favorite' => true,
        'is_saved' => false,
        'play_count' => 5,
    ]);

    $this->actingAs($user)
        ->get(route('catalog.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('games.data.0.user_interaction')
            ->where('games.data.0.user_interaction.is_favorite', true)
        );
});

// ─── Detalle del juego ────────────────────────────────────────

it('muestra el detalle de un juego activo', function () {
    $game = Game::factory()->create(['is_active' => true]);

    $this->get(route('catalog.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('catalog/show')
            ->where('game.data.slug', $game->slug)
        );
});

it('devuelve 404 para juegos inactivos', function () {
    $game = Game::factory()->inactive()->create();

    $this->get(route('catalog.show', $game))->assertNotFound();
});

// ─── Paginación ───────────────────────────────────────────────

it('devuelve 24 resultados y cursor en la primera página', function () {
    Game::factory()->count(30)->create();

    $this->get(route('catalog.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('games.data', 24)
            ->has('games.meta.next_cursor')
        );
});
