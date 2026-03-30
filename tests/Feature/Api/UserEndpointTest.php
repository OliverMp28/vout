<?php

use App\Models\User;
use Laravel\Passport\Passport;

/*
|--------------------------------------------------------------------------
| Tests del Endpoint de Identidad: /api/v1/user/me
|--------------------------------------------------------------------------
|
| Verifica que el endpoint de identidad del ecosistema Vout funciona
| correctamente bajo distintos escenarios de autenticación y scopes.
|
*/

test('devuelve 401 si no se envía token', function () {
    $response = $this->getJson('/api/v1/user/me');

    $response->assertUnauthorized();
});

test('devuelve datos básicos del perfil con scope user:read', function () {
    $user = User::factory()->create([
        'name' => 'Oliver Test',
        'username' => 'oliver_test',
        'avatar' => 'https://example.com/avatar.jpg',
        'email' => 'oliver@test.com',
    ]);

    Passport::actingAs($user, ['user:read']);

    $response = $this->getJson('/api/v1/user/me');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => ['vout_id', 'name', 'username', 'avatar'],
        ])
        ->assertJsonPath('data.vout_id', $user->vout_id)
        ->assertJsonPath('data.name', 'Oliver Test')
        ->assertJsonPath('data.username', 'oliver_test')
        ->assertJsonPath('data.avatar', 'https://example.com/avatar.jpg')
        ->assertJsonMissing(['email']); // Sin scope user:email, no aparece.
});

test('incluye email cuando el token tiene scope user:email', function () {
    $user = User::factory()->create([
        'email' => 'oliver@vout.com',
    ]);

    Passport::actingAs($user, ['user:read', 'user:email']);

    $response = $this->getJson('/api/v1/user/me');

    $response->assertOk()
        ->assertJsonPath('data.email', 'oliver@vout.com');
});

test('nunca expone el ID autoincremental del usuario', function () {
    $user = User::factory()->create();

    Passport::actingAs($user, ['user:read', 'user:email']);

    $response = $this->getJson('/api/v1/user/me');

    $response->assertOk()
        ->assertJsonMissingPath('data.id')
        ->assertJsonMissingPath('data.google_id')
        ->assertJsonMissingPath('data.password');
});
