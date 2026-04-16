<?php

use App\Models\RegisteredApp;
use App\Models\User;
use Laravel\Passport\Passport;

use function Pest\Laravel\actingAs;

it('permite actualizar app_url y allowed_origins al propietario', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($user)->create([
        'app_url' => 'https://v1.test',
        'allowed_origins' => ['https://v1.test'],
    ]);

    actingAs($user)->put(route('developers.apps.update', $app), [
        'app_url' => 'https://v2.test',
        'allowed_origins' => ['https://v2.test', 'https://www.v2.test'],
    ])->assertRedirect(route('developers.apps.show', $app));

    expect($app->fresh())
        ->app_url->toBe('https://v2.test')
        ->and($app->fresh()->allowed_origins)->toBe(['https://v2.test', 'https://www.v2.test']);
});

it('propaga los redirect_uris al client OAuth al actualizar', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($user)->withClient()->create([
        'allowed_origins' => ['https://foo.test'],
    ]);

    actingAs($user)->put(route('developers.apps.update', $app), [
        'redirect_uris' => ['https://foo.test/oauth/callback'],
    ])->assertRedirect();

    $client = Passport::client()->newQuery()->find($app->oauth_client_id);
    expect($client->redirect_uris)->toBe(['https://foo.test/oauth/callback']);
});

it('bloquea a extraños al actualizar una app ajena', function (): void {
    $owner = User::factory()->create();
    $stranger = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();

    actingAs($stranger)->put(route('developers.apps.update', $app), [
        'app_url' => 'https://hijack.test',
    ])->assertForbidden();
});

it('regenera el secreto y lo devuelve solo una vez', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($user)->withClient()->create();

    $originalSecret = Passport::client()->newQuery()->find($app->oauth_client_id)->secret;

    $response = actingAs($user)->post(route('developers.apps.secret', $app));
    $response->assertRedirect(route('developers.apps.show', $app))
        ->assertSessionHas('created_client_secret');

    $newSecret = Passport::client()->newQuery()->find($app->oauth_client_id)->secret;
    expect($newSecret)->not->toBe($originalSecret);
});

it('404 al regenerar secreto si la app no tiene client OAuth', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($user)->create(['oauth_client_id' => null]);

    actingAs($user)->post(route('developers.apps.secret', $app))->assertNotFound();
});

it('alterna is_active entre activo y pausado', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($user)->create(['is_active' => true]);

    actingAs($user)->post(route('developers.apps.toggle', $app))->assertRedirect();
    expect($app->fresh()->is_active)->toBeFalse();

    actingAs($user)->post(route('developers.apps.toggle', $app))->assertRedirect();
    expect($app->fresh()->is_active)->toBeTrue();
});

it('elimina la app y el client OAuth asociado', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($user)->withClient()->create();
    $clientId = $app->oauth_client_id;

    actingAs($user)->delete(route('developers.apps.destroy', $app))
        ->assertRedirect(route('developers.dashboard'));

    expect(RegisteredApp::query()->find($app->id))->toBeNull();
    expect(Passport::client()->newQuery()->find($clientId))->toBeNull();
});

it('el listado del dashboard solo muestra las apps del propietario', function (): void {
    $alice = User::factory()->create();
    $bob = User::factory()->create();
    RegisteredApp::factory()->forUser($alice)->count(2)->create();
    RegisteredApp::factory()->forUser($bob)->count(3)->create();

    $response = actingAs($alice)->get(route('developers.dashboard'));
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->component('developers/dashboard/index', false)
        ->has('apps', 2));
});
