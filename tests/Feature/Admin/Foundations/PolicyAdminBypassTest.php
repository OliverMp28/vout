<?php

use App\Enums\GameStatus;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;

it('un admin puede ver, editar y eliminar apps de cualquier dueño', function (): void {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();

    expect($admin->can('view', $app))->toBeTrue()
        ->and($admin->can('update', $app))->toBeTrue()
        ->and($admin->can('delete', $app))->toBeTrue();
});

it('un admin puede ver, editar y eliminar juegos publicados ajenos', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->create(['status' => GameStatus::Published]);

    expect($admin->can('view', $game))->toBeTrue()
        ->and($admin->can('update', $game))->toBeTrue()
        ->and($admin->can('delete', $game))->toBeTrue();
});

it('el bypass de admin no rompe la lógica para usuarios normales', function (): void {
    $owner = User::factory()->create();
    $stranger = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();

    expect($owner->can('update', $app))->toBeTrue()
        ->and($stranger->can('update', $app))->toBeFalse();
});

it('un admin puede acceder a un juego curado internamente (sin submitter)', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create(['submitted_by_user_id' => null]);

    expect($admin->can('view', $game))->toBeTrue()
        ->and($admin->can('update', $game))->toBeTrue()
        ->and($admin->can('delete', $game))->toBeTrue();
});

it('el gate global "admin" devuelve true solo para administradores', function (): void {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create();

    expect($admin->can('admin'))->toBeTrue()
        ->and($user->can('admin'))->toBeFalse();
});
