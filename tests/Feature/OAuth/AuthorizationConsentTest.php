<?php

use App\Models\RegisteredApp;
use App\Models\User;
use Laravel\Passport\ClientRepository;

/*
 * Pantalla de consentimiento OAuth (`Passport::authorizationView()`).
 *
 * Antes de este registro, un GET a `/oauth/authorize` desde una app
 * third-party reventaba con `BindingResolutionException` (Passport 13
 * exige binding explícito de `AuthorizationViewResponse`). Tests:
 *
 *   - Third-party clients reciben Inertia 'oauth/authorize' con los props
 *     correctos (client, oauthUser, scopes, authToken, redirectUri).
 *   - First-party clients (`is_first_party=true`) saltan la pantalla y
 *     reciben el redirect 302 directo al callback con el `code`.
 *   - Si el user no está autenticado, Passport redirige a /login (sigue
 *     siendo la rama anterior, pero la cubrimos por regresión).
 */

beforeEach(function (): void {
    $this->setUpPassport();
});

/**
 * Crea un cliente OAuth real vía Passport's ClientRepository (mismo
 * camino que usa el StoreDeveloperAppController en producción) y lo
 * vincula a un RegisteredApp. Más fiable que el factory `withClient()`
 * para tests del flujo OAuth real.
 */
function makeOAuthCallable(User $user, array $appOverrides = []): RegisteredApp
{
    $redirectUri = $appOverrides['redirect_uri'] ?? 'https://daino.test/auth/callback';
    unset($appOverrides['redirect_uri']);

    $client = app(ClientRepository::class)->createAuthorizationCodeGrantClient(
        name: $appOverrides['name'] ?? 'Daino Test',
        redirectUris: [$redirectUri],
        confidential: true,
        user: $user,
    );

    return RegisteredApp::factory()
        ->forUser($user)
        ->create(array_merge([
            'oauth_client_id' => $client->id,
            'allowed_origins' => ['https://daino.test'],
            'app_url' => 'https://daino.test',
            'is_first_party' => false,
        ], $appOverrides));
}

it('renderiza la pantalla de consentimiento Inertia para clientes third-party', function (): void {
    $user = User::factory()->create();
    $app = makeOAuthCallable($user, ['is_first_party' => false]);

    $response = $this->actingAs($user)->get('/oauth/authorize?'.http_build_query([
        'client_id' => $app->oauth_client_id,
        'redirect_uri' => 'https://daino.test/auth/callback',
        'response_type' => 'code',
        'scope' => 'user:read user:email',
        'state' => 'random-state-xyz',
        'code_challenge' => str_repeat('a', 43),
        'code_challenge_method' => 'S256',
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('oauth/authorize')
        ->where('client.id', $app->oauth_client_id)
        ->where('client.name', $app->name)
        ->where('client.app_url', $app->app_url)
        ->where('client.is_first_party', false)
        ->where('oauthUser.email', $user->email)
        ->where('oauthUser.vout_id', $user->vout_id)
        ->has('scopes', 2)
        ->where('scopes.0.id', 'user:read')
        ->where('scopes.1.id', 'user:email')
        ->where('redirectUri', 'https://daino.test/auth/callback')
        ->has('authToken')
        ->has('csrfToken')
    );
});

it('el POST /oauth/authorize con auth_token redirige al callback del client (no XHR/CORS)', function (): void {
    $user = User::factory()->create();
    $app = makeOAuthCallable($user, ['is_first_party' => false]);

    // Paso 1 — GET pone authRequest + authToken en sesión.
    $get = $this->actingAs($user)->get('/oauth/authorize?'.http_build_query([
        'client_id' => $app->oauth_client_id,
        'redirect_uri' => 'https://daino.test/auth/callback',
        'response_type' => 'code',
        'scope' => 'user:read',
        'state' => 'state-form',
        'code_challenge' => str_repeat('e', 43),
        'code_challenge_method' => 'S256',
    ]));
    $get->assertOk();
    $authToken = $get->getOriginalContent()->getData()['page']['props']['authToken'];

    // Paso 2 — el form HTML nativo POSTea (no XHR). Passport responde
    // con 302 al `redirect_uri` con `?code=...&state=...`. El navegador
    // sigue ese redirect como navegación, no por XHR — por eso aquí el
    // test no se preocupa por CORS.
    $post = $this->actingAs($user)->post('/oauth/authorize', [
        'auth_token' => $authToken,
    ]);

    $post->assertStatus(302);
    $location = $post->headers->get('Location');
    expect($location)->toStartWith('https://daino.test/auth/callback');
    expect($location)->toContain('code=');
    expect($location)->toContain('state=state-form');
});

it('el DELETE /oauth/authorize con auth_token redirige con error=access_denied', function (): void {
    $user = User::factory()->create();
    $app = makeOAuthCallable($user, ['is_first_party' => false]);

    $get = $this->actingAs($user)->get('/oauth/authorize?'.http_build_query([
        'client_id' => $app->oauth_client_id,
        'redirect_uri' => 'https://daino.test/auth/callback',
        'response_type' => 'code',
        'scope' => 'user:read',
        'state' => 'state-deny',
        'code_challenge' => str_repeat('f', 43),
        'code_challenge_method' => 'S256',
    ]));
    $authToken = $get->getOriginalContent()->getData()['page']['props']['authToken'];

    $delete = $this->actingAs($user)->delete('/oauth/authorize', [
        'auth_token' => $authToken,
    ]);

    $delete->assertStatus(302);
    $location = $delete->headers->get('Location');
    expect($location)->toStartWith('https://daino.test/auth/callback');
    expect($location)->toContain('error=access_denied');
    expect($location)->toContain('state=state-deny');
});

it('los clientes first-party saltan la pantalla y reciben 302 al callback', function (): void {
    $user = User::factory()->create();
    $app = makeOAuthCallable($user, ['is_first_party' => true]);

    $response = $this->actingAs($user)->get('/oauth/authorize?'.http_build_query([
        'client_id' => $app->oauth_client_id,
        'redirect_uri' => 'https://daino.test/auth/callback',
        'response_type' => 'code',
        'scope' => 'user:read',
        'state' => 'state-skip',
        'code_challenge' => str_repeat('b', 43),
        'code_challenge_method' => 'S256',
    ]));

    // Skip de consent → Passport completa el authorization request y
    // redirige al callback con el ?code=... — no hay vista intermedia.
    $response->assertStatus(302);
    $location = $response->headers->get('Location');
    expect($location)->toStartWith('https://daino.test/auth/callback');
    expect($location)->toContain('code=');
    expect($location)->toContain('state=state-skip');
});

it('si el user no está autenticado, Passport redirige a /login (regresión)', function (): void {
    $owner = User::factory()->create();
    $app = makeOAuthCallable($owner);

    $response = $this->get('/oauth/authorize?'.http_build_query([
        'client_id' => $app->oauth_client_id,
        'redirect_uri' => 'https://daino.test/auth/callback',
        'response_type' => 'code',
        'scope' => 'user:read',
        'state' => 'state-anon',
        'code_challenge' => str_repeat('c', 43),
        'code_challenge_method' => 'S256',
    ]));

    $response->assertRedirect('/login');
});

it('la pantalla incluye descripciones humanas de los scopes (i18n vout.scopes)', function (): void {
    $user = User::factory()->create();
    $app = makeOAuthCallable($user, ['is_first_party' => false]);

    $expectedDescription = (string) config('vout.scopes.user:read');

    $response = $this->actingAs($user)->get('/oauth/authorize?'.http_build_query([
        'client_id' => $app->oauth_client_id,
        'redirect_uri' => 'https://daino.test/auth/callback',
        'response_type' => 'code',
        'scope' => 'user:read',
        'state' => 'state',
        'code_challenge' => str_repeat('d', 43),
        'code_challenge_method' => 'S256',
    ]));

    $response->assertInertia(fn ($page) => $page
        ->where('scopes.0.description', $expectedDescription)
    );
});
