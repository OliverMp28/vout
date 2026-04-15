<?php

use App\Models\RegisteredApp;
use App\Models\User;

it('permite al propietario ver, actualizar y eliminar su aplicación', function (): void {
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();

    expect($owner->can('view', $app))->toBeTrue()
        ->and($owner->can('update', $app))->toBeTrue()
        ->and($owner->can('delete', $app))->toBeTrue();
});

it('niega a otro usuario ver, actualizar o eliminar una aplicación ajena', function (): void {
    $owner = User::factory()->create();
    $stranger = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();

    expect($stranger->can('view', $app))->toBeFalse()
        ->and($stranger->can('update', $app))->toBeFalse()
        ->and($stranger->can('delete', $app))->toBeFalse();
});

it('niega acceso a aplicaciones huérfanas (user_id null) incluso a un usuario válido', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->create(['user_id' => null]);

    expect($user->can('view', $app))->toBeFalse()
        ->and($user->can('update', $app))->toBeFalse()
        ->and($user->can('delete', $app))->toBeFalse();
});

it('cualquier usuario autenticado puede ver el listado y crear apps', function (): void {
    $user = User::factory()->create();

    expect($user->can('viewAny', RegisteredApp::class))->toBeTrue()
        ->and($user->can('create', RegisteredApp::class))->toBeTrue();
});
