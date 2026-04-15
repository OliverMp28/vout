<?php

use App\Models\RegisteredApp;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\post;

it('crea una app con IdP y devuelve el secreto vía flash una sola vez', function (): void {
    $user = User::factory()->create();

    $response = actingAs($user)->post(route('developers.apps.store'), [
        'name' => 'Dino Online',
        'app_url' => 'https://dino.test',
        'requires_auth' => true,
        'confidential' => true,
        'allowed_origins' => ['https://dino.test'],
        'redirect_uris' => ['https://dino.test/oauth/callback'],
    ]);

    $app = RegisteredApp::query()->where('slug', 'dino-online')->first();

    expect($app)->not->toBeNull()
        ->and($app->user_id)->toBe($user->id)
        ->and($app->requires_auth)->toBeTrue()
        ->and($app->oauth_client_id)->not->toBeNull()
        ->and($app->is_first_party)->toBeFalse()
        ->and($app->is_active)->toBeTrue()
        ->and($app->allowed_origins)->toBe(['https://dino.test']);

    $response->assertRedirect(route('developers.apps.show', $app));
    $response->assertSessionHas('created_client_secret');
    expect($response->getSession()->get('created_client_secret'))
        ->toBeString()
        ->and(strlen($response->getSession()->get('created_client_secret')))->toBeGreaterThanOrEqual(32);

    $followUp = actingAs($user)->get(route('developers.apps.show', $app));
    $followUp->assertSessionMissing('created_client_secret');
});

it('crea una app cliente-puro sin IdP (sin oauth_client)', function (): void {
    $user = User::factory()->create();

    actingAs($user)->post(route('developers.apps.store'), [
        'name' => 'Tetris Solo',
        'app_url' => 'https://tetris.test',
        'requires_auth' => false,
        'allowed_origins' => ['https://tetris.test'],
    ])->assertRedirect();

    $app = RegisteredApp::query()->where('slug', 'tetris-solo')->firstOrFail();

    expect($app->requires_auth)->toBeFalse()
        ->and($app->oauth_client_id)->toBeNull();
});

it('rechaza la creación con redirect_uri fuera de allowed_origins', function (): void {
    $user = User::factory()->create();

    $response = actingAs($user)->post(route('developers.apps.store'), [
        'name' => 'Bad App',
        'app_url' => 'https://bad.test',
        'requires_auth' => true,
        'confidential' => true,
        'allowed_origins' => ['https://bad.test'],
        'redirect_uris' => ['https://otro-dominio.test/oauth/callback'],
    ]);

    $response->assertSessionHasErrors('redirect_uris.0');
    expect(RegisteredApp::query()->count())->toBe(0);
});

it('rechaza la creación sin redirect_uris cuando requires_auth=true', function (): void {
    $user = User::factory()->create();

    $response = actingAs($user)->post(route('developers.apps.store'), [
        'name' => 'Missing Redirect',
        'app_url' => 'https://missing.test',
        'requires_auth' => true,
        'confidential' => true,
        'allowed_origins' => ['https://missing.test'],
    ]);

    $response->assertSessionHasErrors('redirect_uris');
});

it('obliga a unicidad del nombre por usuario', function (): void {
    $user = User::factory()->create();
    RegisteredApp::factory()->forUser($user)->create(['name' => 'Repetida']);

    $response = actingAs($user)->post(route('developers.apps.store'), [
        'name' => 'Repetida',
        'app_url' => 'https://repetida.test',
        'requires_auth' => false,
        'allowed_origins' => ['https://repetida.test'],
    ]);

    $response->assertSessionHasErrors('name');
});

it('genera slugs únicos cuando dos usuarios eligen el mismo nombre', function (): void {
    $alice = User::factory()->create();
    $bob = User::factory()->create();

    actingAs($alice)->post(route('developers.apps.store'), [
        'name' => 'Mi Juego',
        'app_url' => 'https://alice.test',
        'requires_auth' => false,
        'allowed_origins' => ['https://alice.test'],
    ])->assertRedirect();

    actingAs($bob)->post(route('developers.apps.store'), [
        'name' => 'Mi Juego',
        'app_url' => 'https://bob.test',
        'requires_auth' => false,
        'allowed_origins' => ['https://bob.test'],
    ])->assertRedirect();

    $slugs = RegisteredApp::query()->pluck('slug')->all();
    expect($slugs)->toHaveCount(2)
        ->and($slugs[0])->not->toBe($slugs[1]);
});

it('un invitado no puede crear apps', function (): void {
    post(route('developers.apps.store'), [
        'name' => 'Anon',
        'app_url' => 'https://anon.test',
        'requires_auth' => false,
        'allowed_origins' => ['https://anon.test'],
    ])->assertRedirect(route('login'));

    expect(RegisteredApp::query()->count())->toBe(0);
});
