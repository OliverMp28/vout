<?php

use App\Models\OAuthUserGrant;
use App\Models\Passport\Client;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Notifications\OAuthGrantRevokedNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;

/*
 * Tests de la página /settings/connected-apps y su flujo de revoke.
 *
 * No tocan el flujo OAuth real ni el listener: usan factories directas
 * sobre OAuthUserGrant para aislar la pieza de Settings.
 */

beforeEach(function (): void {
    $this->setUpPassport();
});

function makeAppGrantPair(User $user, array $appOverrides = []): array
{
    $owner = User::factory()->create();
    $client = Client::create([
        'id' => (string) Str::uuid(),
        'owner_type' => User::class,
        'owner_id' => $owner->id,
        'name' => 'Settings Test Client',
        'secret' => Str::random(40),
        'redirect_uris' => ['https://settings.test/cb'],
        'grant_types' => ['authorization_code', 'refresh_token'],
        'revoked' => false,
    ]);
    $app = RegisteredApp::factory()
        ->forUser($owner)
        ->create(array_merge([
            'oauth_client_id' => $client->id,
            'is_first_party' => false,
        ], $appOverrides));

    $grant = OAuthUserGrant::factory()
        ->forUser($user)
        ->forClient($client)
        ->withScopes(['user:read'])
        ->create();

    return ['app' => $app, 'client' => $client, 'grant' => $grant];
}

test('connected-apps redirige a login a usuarios no autenticados', function (): void {
    $response = $this->get(route('connected-apps.index'));

    $response->assertRedirect(route('login'));
});

test('connected-apps muestra los grants third-party activos del usuario', function (): void {
    $user = User::factory()->create();
    $pair = makeAppGrantPair($user);

    $response = $this->actingAs($user)->get(route('connected-apps.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('settings/connected-apps')
        ->has('grants', 1)
        ->where('grants.0.id', $pair['grant']->id)
        ->where('grants.0.app.name', $pair['app']->name)
        ->where('grants.0.scopes.0.id', 'user:read')
    );
});

test('connected-apps oculta apps first-party', function (): void {
    $user = User::factory()->create();
    makeAppGrantPair($user, ['is_first_party' => true]);

    $response = $this->actingAs($user)->get(route('connected-apps.index'));

    $response->assertInertia(fn ($page) => $page
        ->component('settings/connected-apps')
        ->has('grants', 0)
    );
});

test('connected-apps oculta grants huérfanos (RegisteredApp borrada)', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $client = Client::create([
        'id' => (string) Str::uuid(),
        'owner_type' => User::class,
        'owner_id' => $owner->id,
        'name' => 'Orphan',
        'secret' => Str::random(40),
        'redirect_uris' => ['https://orphan.test/cb'],
        'grant_types' => ['authorization_code'],
        'revoked' => false,
    ]);

    OAuthUserGrant::factory()
        ->forUser($user)
        ->forClient($client)
        ->create();

    $response = $this->actingAs($user)->get(route('connected-apps.index'));

    $response->assertInertia(fn ($page) => $page->has('grants', 0));
});

test('connected-apps NO muestra grants de otros usuarios', function (): void {
    $userA = User::factory()->create();
    $userB = User::factory()->create();
    makeAppGrantPair($userB);

    $response = $this->actingAs($userA)->get(route('connected-apps.index'));

    $response->assertInertia(fn ($page) => $page->has('grants', 0));
});

test('connected-apps oculta grants revocados', function (): void {
    $user = User::factory()->create();
    $pair = makeAppGrantPair($user);
    $pair['grant']->forceFill(['revoked_at' => now()])->save();

    $response = $this->actingAs($user)->get(route('connected-apps.index'));

    $response->assertInertia(fn ($page) => $page->has('grants', 0));
});

test('DELETE /connected-apps/{grant} revoca el grant y cascadea sobre tokens', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $pair = makeAppGrantPair($user);

    $token = Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $pair['client']->id,
        'name' => null,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);
    $refresh = RefreshToken::create([
        'id' => Str::random(80),
        'access_token_id' => $token->id,
        'revoked' => false,
        'expires_at' => now()->addDays(30),
    ]);

    $response = $this->actingAs($user)
        ->delete(route('connected-apps.destroy', $pair['grant']));

    $response->assertRedirect();
    expect($pair['grant']->fresh()->revoked_at)->not->toBeNull();
    expect($token->fresh()->revoked)->toBeTrue();
    expect($refresh->fresh()->revoked)->toBeTrue();

    Notification::assertSentTo($user, OAuthGrantRevokedNotification::class);
});

test('DELETE /connected-apps/{grant} bloquea el revoke de un grant ajeno (anti-IDOR)', function (): void {
    Notification::fake();

    $userA = User::factory()->create();
    $userB = User::factory()->create();
    $pair = makeAppGrantPair($userB);

    $response = $this->actingAs($userA)
        ->delete(route('connected-apps.destroy', $pair['grant']));

    $response->assertForbidden();
    expect($pair['grant']->fresh()->revoked_at)->toBeNull();
    Notification::assertNothingSent();
});
