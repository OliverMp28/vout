<?php

use App\Models\Category;
use App\Models\RegisteredApp;
use App\Models\User;

use function Pest\Laravel\actingAs;

/*
 * Cobertura del flag `vout.allow_insecure_urls` y de las reglas
 * `PortableUrl` / `PortableOrigin`:
 *
 *  - En dev (flag = true) se aceptan `http://localhost:PUERTO` para
 *    `allowed_origins`, `redirect_uris`, `app_url`, `embed_url`...
 *  - En prod (flag = false) las URLs http son rechazadas.
 *  - El `embed_url` puede ser exactamente la raíz del origen (sin path).
 */

function devApp(User $user, array $attributes = []): RegisteredApp
{
    return RegisteredApp::factory()
        ->forUser($user)
        ->create(array_merge([
            'allowed_origins' => ['http://localhost:3000'],
        ], $attributes));
}

it('permite registrar una app con allowed_origins http://localhost en dev', function (): void {
    config()->set('vout.allow_insecure_urls', true);

    $user = User::factory()->create();

    $response = actingAs($user)->post(route('developers.apps.store'), [
        'name' => 'Local Dino',
        'app_url' => 'http://localhost:3000',
        'requires_auth' => false,
        'allowed_origins' => ['http://localhost:3000', 'http://127.0.0.1:8080'],
    ]);

    $response->assertRedirect();
    $response->assertSessionHasNoErrors();

    expect(RegisteredApp::where('user_id', $user->id)->count())->toBe(1);
});

it('rechaza allowed_origins http://localhost cuando el flag está desactivado (modo prod)', function (): void {
    config()->set('vout.allow_insecure_urls', false);

    $user = User::factory()->create();

    $response = actingAs($user)
        ->from(route('developers.apps.create'))
        ->post(route('developers.apps.store'), [
            'name' => 'Local Dino',
            'app_url' => 'http://localhost:3000',
            'requires_auth' => false,
            'allowed_origins' => ['http://localhost:3000'],
        ]);

    $response->assertSessionHasErrors(['app_url', 'allowed_origins.0']);
});

it('rechaza allowed_origins con scheme distinto a http/https', function (): void {
    config()->set('vout.allow_insecure_urls', true);

    $user = User::factory()->create();

    $response = actingAs($user)
        ->from(route('developers.apps.create'))
        ->post(route('developers.apps.store'), [
            'name' => 'Bad Scheme',
            'app_url' => 'https://valid.test',
            'requires_auth' => false,
            'allowed_origins' => ['ftp://files.test'],
        ]);

    $response->assertSessionHasErrors(['allowed_origins.0']);
});

it('permite enviar un juego con embed_url http://localhost en dev', function (): void {
    config()->set('vout.allow_insecure_urls', true);

    $user = User::factory()->create();
    $app = devApp($user);
    $category = Category::factory()->create();

    $response = actingAs($user)->post(route('developers.games.store'), [
        'name' => 'Local Game',
        'description' => str_repeat('Mi juego corre en localhost. ', 3),
        'registered_app_id' => $app->id,
        'embed_url' => 'http://localhost:3000/play',
        'category_ids' => [$category->id],
    ]);

    $response->assertSessionHasNoErrors();
    $response->assertRedirect();
});

it('acepta embed_url igual al origen exacto (raíz, sin path)', function (): void {
    config()->set('vout.allow_insecure_urls', true);

    $user = User::factory()->create();
    $app = devApp($user, ['allowed_origins' => ['http://localhost:5173']]);
    $category = Category::factory()->create();

    $response = actingAs($user)->post(route('developers.games.store'), [
        'name' => 'Root Game',
        'description' => str_repeat('Mi juego vive en la raíz. ', 3),
        'registered_app_id' => $app->id,
        'embed_url' => 'http://localhost:5173',
        'category_ids' => [$category->id],
    ]);

    $response->assertSessionHasNoErrors();
    $response->assertRedirect();
});

it('acepta embed_url raíz con barra final (https://example.com/)', function (): void {
    config()->set('vout.allow_insecure_urls', false);

    $user = User::factory()->create();
    $app = devApp($user, ['allowed_origins' => ['https://example.test']]);
    $category = Category::factory()->create();

    $response = actingAs($user)->post(route('developers.games.store'), [
        'name' => 'Bare Root Slash',
        'description' => str_repeat('Mi juego vive en la raíz con slash. ', 3),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://example.test/',
        'category_ids' => [$category->id],
    ]);

    $response->assertSessionHasNoErrors();
    $response->assertRedirect();
});

it('rechaza embed_url http en modo prod aunque la app declare http en allowed_origins', function (): void {
    // Si por algún motivo la app fue creada en dev y luego se forzó prod, el
    // embed_url nuevo se sigue evaluando contra el flag actual: rechazado.
    config()->set('vout.allow_insecure_urls', false);

    $user = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($user)->create([
        'allowed_origins' => ['http://localhost:3000'],
    ]);
    $category = Category::factory()->create();

    $response = actingAs($user)
        ->from(route('developers.games.create'))
        ->post(route('developers.games.store'), [
            'name' => 'Insecure In Prod',
            'description' => str_repeat('Otro intento sin TLS. ', 3),
            'registered_app_id' => $app->id,
            'embed_url' => 'http://localhost:3000/play',
            'category_ids' => [$category->id],
        ]);

    $response->assertSessionHasErrors('embed_url');
});
