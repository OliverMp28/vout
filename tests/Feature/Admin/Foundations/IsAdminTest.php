<?php

use App\Models\User;

it('por defecto el usuario no es administrador', function (): void {
    $user = User::factory()->create()->fresh();

    expect($user->is_admin)->toBeFalse();
});

it('el factory state admin() crea usuarios con la marca activada', function (): void {
    $admin = User::factory()->admin()->create();

    expect($admin->is_admin)->toBeTrue();
});

it('el scope admins() filtra solo usuarios con privilegios', function (): void {
    User::factory()->count(3)->create();
    $admins = User::factory()->admin()->count(2)->create();

    $result = User::admins()->pluck('id')->all();

    expect($result)->toHaveCount(2)
        ->and($result)->toEqualCanonicalizing($admins->pluck('id')->all());
});

it('el casting devuelve siempre un boolean', function (): void {
    $user = User::factory()->admin()->create();

    expect($user->is_admin)->toBeBool()->toBeTrue();
});
