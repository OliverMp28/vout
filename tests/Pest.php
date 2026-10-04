<?php

use App\Models\Game;
use App\Models\OAuthUserGrant;
use App\Models\RegisteredApp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\ClientRepository;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Browser');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * 1x1 transparent PNG bytes — útil para tests que necesitan simular la descarga
 * de una imagen sin generar archivos pesados ni depender de GD.
 */
function fakePngBytes(): string
{
    return base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    );
}

/**
 * Juego activo cuya `RegisteredApp` tiene un client OAuth real, creado por
 * el mismo camino que el Developer Portal. Third-party salvo que se
 * indique `is_first_party` en los overrides de la app.
 *
 * @param  array<string, mixed>  $appOverrides
 */
function gameWithOAuthApp(array $appOverrides = []): Game
{
    $client = app(ClientRepository::class)->createAuthorizationCodeGrantClient(
        name: 'Embedded Test App',
        redirectUris: ['https://embedded.test/auth/callback'],
        confidential: true,
    );

    $app = RegisteredApp::factory()->create(array_merge([
        'oauth_client_id' => $client->id,
        'allowed_origins' => ['https://embedded.test'],
        'app_url' => 'https://embedded.test',
        'is_first_party' => false,
    ], $appOverrides));

    return Game::factory()->forApp($app)->create([
        'is_active' => true,
        'embed_url' => 'https://embedded.test/play',
    ]);
}

/**
 * Deja al usuario con la app del juego ya autorizada (grant activo).
 *
 * @param  list<string>  $scopes
 */
function authorizeGameApp(User $user, Game $game, array $scopes = ['user:read']): OAuthUserGrant
{
    return OAuthUserGrant::factory()->forUser($user)->withScopes($scopes)->create([
        'client_id' => $game->registeredApp->oauth_client_id,
    ]);
}

/**
 * Decodifica una sección (0 = header, 1 = payload) de un JWT sin verificar firma.
 *
 * @return array<string, mixed>
 */
function decodeJwtSection(string $jwt, int $section): array
{
    return json_decode(base64_decode(strtr(explode('.', $jwt)[$section], '-_', '+/')), true);
}
