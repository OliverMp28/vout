<?php

use App\Models\Category;
use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── scopeActive / scopeFeatured ─────────────────────────────

it('scopeActive devuelve solo juegos activos', function () {
    Game::factory()->count(3)->create(['is_active' => true]);
    Game::factory()->count(2)->inactive()->create();

    expect(Game::query()->active()->count())->toBe(3);
});

it('scopeFeatured devuelve solo juegos destacados', function () {
    Game::factory()->count(2)->featured()->create();
    Game::factory()->count(3)->create(['is_featured' => false]);

    expect(Game::query()->featured()->count())->toBe(2);
});

// ─── scopeInCategories ───────────────────────────────────────

it('scopeInCategories filtra por una sola categoría', function () {
    $puzzle = Category::factory()->create(['name' => 'Puzzle', 'slug' => 'puzzle']);
    $action = Category::factory()->create(['name' => 'Acción', 'slug' => 'accion']);

    $puzzleGame = Game::factory()->create();
    $actionGame = Game::factory()->create();
    $bothGame = Game::factory()->create();

    $puzzleGame->categories()->attach($puzzle);
    $actionGame->categories()->attach($action);
    $bothGame->categories()->attach([$puzzle->id, $action->id]);

    $results = Game::query()->inCategories(['puzzle'])->pluck('id');

    expect($results)->toContain($puzzleGame->id)
        ->toContain($bothGame->id)
        ->not->toContain($actionGame->id);
});

it('scopeInCategories usa lógica OR entre categorías', function () {
    $puzzle = Category::factory()->create(['slug' => 'puzzle']);
    $action = Category::factory()->create(['slug' => 'accion']);
    $sport = Category::factory()->create(['slug' => 'deportes']);

    $puzzleGame = Game::factory()->create();
    $actionGame = Game::factory()->create();
    $sportGame = Game::factory()->create();

    $puzzleGame->categories()->attach($puzzle);
    $actionGame->categories()->attach($action);
    $sportGame->categories()->attach($sport);

    $results = Game::query()->inCategories(['puzzle', 'accion'])->pluck('id');

    expect($results)->toContain($puzzleGame->id)
        ->toContain($actionGame->id)
        ->not->toContain($sportGame->id);
});

it('scopeInCategories con array vacío no filtra nada', function () {
    Game::factory()->count(3)->create();

    expect(Game::query()->inCategories([])->count())->toBe(3);
});

// ─── scopeSearch ─────────────────────────────────────────────

it('scopeSearch encuentra juegos por nombre', function () {
    Game::factory()->create(['name' => 'Retro Invaders', 'description' => 'Un juego cualquiera.']);
    Game::factory()->create(['name' => 'Color Chain', 'description' => 'Otro juego.']);

    $results = Game::query()->search('Retro')->pluck('name');

    expect($results)->toContain('Retro Invaders')
        ->not->toContain('Color Chain');
});

it('scopeSearch encuentra juegos por descripción', function () {
    Game::factory()->create(['name' => 'Juego Alpha', 'description' => 'Controla el personaje con gestos faciales únicos.']);
    Game::factory()->create(['name' => 'Juego Beta', 'description' => 'Un shooter clásico de plataformas.']);

    $results = Game::query()->search('gestos')->pluck('name');

    expect($results)->toContain('Juego Alpha')
        ->not->toContain('Juego Beta');
});

it('scopeSearch con término vacío no filtra', function () {
    Game::factory()->count(4)->create();

    expect(Game::query()->search('')->count())->toBe(4);
});

// ─── scopeSortedBy ───────────────────────────────────────────

it('scopeSortedBy popular ordena por play_count descendente', function () {
    Game::factory()->create(['name' => 'Poco Jugado', 'play_count' => 100]);
    Game::factory()->create(['name' => 'Muy Jugado', 'play_count' => 9999]);
    Game::factory()->create(['name' => 'Medio', 'play_count' => 500]);

    $names = Game::query()->sortedBy('popular')->pluck('name');

    expect($names->first())->toBe('Muy Jugado')
        ->and($names->last())->toBe('Poco Jugado');
});

it('scopeSortedBy newest ordena por release_date descendente', function () {
    Game::factory()->create(['name' => 'Antiguo', 'release_date' => '2022-01-01']);
    Game::factory()->create(['name' => 'Reciente', 'release_date' => '2024-06-15']);
    Game::factory()->create(['name' => 'Medio', 'release_date' => '2023-03-10']);

    $names = Game::query()->sortedBy('newest')->pluck('name');

    expect($names->first())->toBe('Reciente')
        ->and($names->last())->toBe('Antiguo');
});

it('scopeSortedBy alphabetical ordena A-Z', function () {
    Game::factory()->create(['name' => 'Zebra Rush']);
    Game::factory()->create(['name' => 'Alpha Run']);
    Game::factory()->create(['name' => 'Moon Dash']);

    $names = Game::query()->sortedBy('alphabetical')->pluck('name');

    expect($names->first())->toBe('Alpha Run')
        ->and($names->last())->toBe('Zebra Rush');
});

// ─── scopeWithUserInteraction ────────────────────────────────

it('scopeWithUserInteraction adjunta datos del pivote del usuario', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $user->games()->attach($game, [
        'is_favorite' => true,
        'is_saved' => false,
        'play_count' => 7,
        'best_score' => 1500,
        'last_played_at' => now(),
    ]);

    $result = Game::query()->withUserInteraction($user->id)->find($game->id);

    expect((bool) $result->is_favorite)->toBeTrue()
        ->and((bool) $result->is_saved)->toBeFalse()
        ->and((int) $result->play_count_user)->toBe(7)
        ->and((int) $result->best_score)->toBe(1500);
});

it('scopeWithUserInteraction devuelve null en pivote para juegos sin interacción', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $result = Game::query()->withUserInteraction($user->id)->find($game->id);

    expect($result->is_favorite)->toBeNull()
        ->and($result->is_saved)->toBeNull();
});
