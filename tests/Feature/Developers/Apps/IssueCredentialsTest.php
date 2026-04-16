<?php

use App\Models\RegisteredApp;
use App\Models\User;
use Laravel\Passport\Passport;

use function Pest\Laravel\actingAs;

it('emite nuevas credenciales para una app con requires_auth y sin client', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()
        ->forUser($user)
        ->create([
            'requires_auth' => true,
            'oauth_client_id' => null,
            'allowed_origins' => ['https://app.test'],
        ]);

    $response = actingAs($user)->post(route('developers.apps.credentials', $app), [
        'confidential' => true,
        'redirect_uris' => ['https://app.test/oauth/callback'],
    ]);

    $response->assertRedirect(route('developers.apps.show', $app))
        ->assertSessionHas('created_client_secret');

    $app->refresh();
    expect($app->oauth_client_id)->not->toBeNull();

    $client = Passport::client()->newQuery()->find($app->oauth_client_id);
    expect($client)->not->toBeNull()
        ->and($client->redirect_uris)->toBe(['https://app.test/oauth/callback'])
        ->and((bool) $client->confidential())->toBeTrue();
});

it('permite emitir credenciales de SPA (no confidential)', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()
        ->forUser($user)
        ->create([
            'requires_auth' => true,
            'oauth_client_id' => null,
            'allowed_origins' => ['https://spa.test'],
        ]);

    actingAs($user)->post(route('developers.apps.credentials', $app), [
        'confidential' => false,
        'redirect_uris' => ['https://spa.test/callback'],
    ])->assertRedirect(route('developers.apps.show', $app));

    $client = Passport::client()->newQuery()->find($app->fresh()->oauth_client_id);
    expect((bool) $client->confidential())->toBeFalse();
});

it('rechaza 403 si la app está suspendida', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()
        ->forUser($user)
        ->suspended()
        ->create([
            'requires_auth' => true,
            'oauth_client_id' => null,
            'allowed_origins' => ['https://app.test'],
        ]);

    actingAs($user)->post(route('developers.apps.credentials', $app), [
        'confidential' => true,
        'redirect_uris' => ['https://app.test/cb'],
    ])->assertForbidden();

    expect($app->fresh()->oauth_client_id)->toBeNull();
});

it('rechaza 422 si la app no declara requires_auth', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()
        ->forUser($user)
        ->create([
            'requires_auth' => false,
            'oauth_client_id' => null,
            'allowed_origins' => ['https://app.test'],
        ]);

    actingAs($user)->post(route('developers.apps.credentials', $app), [
        'confidential' => true,
        'redirect_uris' => ['https://app.test/cb'],
    ])->assertStatus(422);
});

it('rechaza 409 si la app ya tiene un client activo', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()
        ->forUser($user)
        ->withClient()
        ->create([
            'requires_auth' => true,
            'allowed_origins' => ['https://app.test'],
        ]);

    $existingClientId = $app->oauth_client_id;

    actingAs($user)->post(route('developers.apps.credentials', $app), [
        'confidential' => true,
        'redirect_uris' => ['https://app.test/cb'],
    ])->assertStatus(409);

    expect($app->fresh()->oauth_client_id)->toBe($existingClientId);
});

it('rechaza redirect_uris fuera de allowed_origins', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()
        ->forUser($user)
        ->create([
            'requires_auth' => true,
            'oauth_client_id' => null,
            'allowed_origins' => ['https://app.test'],
        ]);

    $response = actingAs($user)
        ->from(route('developers.apps.show', $app))
        ->post(route('developers.apps.credentials', $app), [
            'confidential' => true,
            'redirect_uris' => ['https://evil.test/callback'],
        ]);

    $response->assertRedirect(route('developers.apps.show', $app))
        ->assertSessionHasErrors('redirect_uris.0');

    expect($app->fresh()->oauth_client_id)->toBeNull();
});

it('bloquea a extraños con 403 al emitir credenciales de una app ajena', function (): void {
    $owner = User::factory()->create();
    $stranger = User::factory()->create();
    $app = RegisteredApp::factory()
        ->forUser($owner)
        ->create([
            'requires_auth' => true,
            'oauth_client_id' => null,
            'allowed_origins' => ['https://app.test'],
        ]);

    actingAs($stranger)->post(route('developers.apps.credentials', $app), [
        'confidential' => true,
        'redirect_uris' => ['https://app.test/cb'],
    ])->assertForbidden();

    expect($app->fresh()->oauth_client_id)->toBeNull();
});
