<?php

use App\Enums\GameStatus;
use App\Models\Game;
use App\Models\User;

it('permite al desarrollador ver su propio juego enviado', function (): void {
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->draft()->create();

    expect($dev->can('view', $game))->toBeTrue();
});

it('niega ver el juego de otro desarrollador', function (): void {
    $dev = User::factory()->create();
    $stranger = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->draft()->create();

    expect($stranger->can('view', $game))->toBeFalse();
});

it('permite editar el juego en cualquier estado del ciclo de moderación', function (GameStatus $status): void {
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->state(['status' => $status])->create();

    expect($dev->can('update', $game))->toBeTrue();
})->with([
    GameStatus::Draft,
    GameStatus::PendingReview,
    GameStatus::Rejected,
    GameStatus::Published,
]);

it('bloquea el borrado cuando el juego ya está publicado, pero permite seguir editándolo', function (): void {
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->create(['status' => GameStatus::Published]);

    expect($dev->can('update', $game))->toBeTrue()
        ->and($dev->can('delete', $game))->toBeFalse();
});

it('permite eliminar el juego mientras no esté publicado', function (): void {
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->draft()->create();

    expect($dev->can('delete', $game))->toBeTrue();
});

it('los juegos curados internamente (sin submitter) no son editables desde el portal', function (): void {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['submitted_by_user_id' => null]);

    expect($admin->can('view', $game))->toBeFalse()
        ->and($admin->can('update', $game))->toBeFalse()
        ->and($admin->can('delete', $game))->toBeFalse();
});

it('cualquier usuario autenticado puede listar y crear juegos enviados', function (): void {
    $user = User::factory()->create();

    expect($user->can('viewAny', Game::class))->toBeTrue()
        ->and($user->can('create', Game::class))->toBeTrue();
});
