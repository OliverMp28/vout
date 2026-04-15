<?php

use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;

it('cuando el juego no tiene app vinculada deriva el origen de embed_url', function (): void {
    $game = Game::factory()->create([
        'embed_url' => 'https://dino.vout.com/play',
        'registered_app_id' => null,
    ]);

    expect($game->effective_origins)->toBe(['https://dino.vout.com']);
});

it('cuando hay app vinculada usa allowed_origins de la app', function (): void {
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create([
        'allowed_origins' => [
            'https://dino.vout.com',
            'https://staging.dino.vout.com',
        ],
    ]);

    $game = Game::factory()->forApp($app)->create([
        'embed_url' => 'https://dino.vout.com/play',
    ]);

    expect($game->effective_origins)
        ->toBe(['https://dino.vout.com', 'https://staging.dino.vout.com']);
});

it('si la app vinculada tiene allowed_origins vacíos cae al fallback de embed_url', function (): void {
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create([
        'allowed_origins' => [],
    ]);

    $game = Game::factory()->forApp($app)->create([
        'embed_url' => 'http://localhost:8080/game',
    ]);

    expect($game->effective_origins)->toBe(['http://localhost:8080']);
});

it('sin embed_url ni app la lista de orígenes está vacía', function (): void {
    $game = Game::factory()->create([
        'embed_url' => null,
        'registered_app_id' => null,
    ]);

    expect($game->effective_origins)->toBe([]);
});

it('la relación registeredApp() devuelve la app correcta', function (): void {
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();
    $game = Game::factory()->forApp($app)->create();

    expect($game->registeredApp)->not->toBeNull()
        ->and($game->registeredApp->id)->toBe($app->id)
        ->and($game->submitted_by_user_id)->toBe($owner->id);
});

it('el scope pendingReview() filtra solo juegos en revisión', function (): void {
    $dev = User::factory()->create();
    Game::factory()->submittedBy($dev)->draft()->count(2)->create();
    $pending = Game::factory()->submittedBy($dev)->pendingReview()->count(3)->create();

    $result = Game::pendingReview()->pluck('id')->all();

    expect($result)->toHaveCount(3)
        ->and($result)->toEqualCanonicalizing($pending->pluck('id')->all());
});
