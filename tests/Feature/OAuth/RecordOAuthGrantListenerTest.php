<?php

use App\Listeners\RecordOAuthGrant;
use App\Models\OAuthUserGrant;
use App\Models\Passport\Client;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Notifications\OAuthGrantCreatedNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Passport\ClientRepository;
use Laravel\Passport\Events\AccessTokenCreated;
use Laravel\Passport\Token;

/*
 * Tests del listener `RecordOAuthGrant`.
 *
 * Validan los filtros tempranos (skip first-party, skip null user, skip
 * sin RegisteredApp), la idempotencia con `firstOrCreate`, la
 * reactivación tras revoke, y el incremental consent (mergeScopes).
 *
 * Disparamos el listener directamente vía `event(...)` o invocando el
 * método `handle()` con un evento construido manualmente, en lugar del
 * flujo OAuth completo, para aislar la unidad bajo prueba.
 */

beforeEach(function (): void {
    $this->setUpPassport();
});

function fireAccessTokenCreated(Token $token): void
{
    event(new AccessTokenCreated(
        tokenId: $token->id,
        userId: $token->user_id !== null ? (string) $token->user_id : null,
        clientId: $token->client_id,
    ));
}

function makeListenerToken(User $user, Client $client, array $scopes = ['user:read']): Token
{
    return Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'name' => null,
        'scopes' => $scopes,
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);
}

function makeListenerClient(User $owner, ?RegisteredApp $registeredApp = null): Client
{
    $client = app(ClientRepository::class)->createAuthorizationCodeGrantClient(
        name: 'Listener Test Client',
        redirectUris: ['https://listener.test/cb'],
        confidential: true,
        user: $owner,
    );

    if ($registeredApp !== null) {
        $registeredApp->forceFill(['oauth_client_id' => $client->id])->save();
    }

    return $client;
}

it('crea grant para third-party con RegisteredApp y dispara notification (primer grant)', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeListenerClient($owner, $app);
    $token = makeListenerToken($user, $client, ['user:read']);

    fireAccessTokenCreated($token);

    $grant = OAuthUserGrant::query()
        ->where('user_id', $user->id)
        ->where('client_id', $client->id)
        ->first();

    expect($grant)->not->toBeNull();
    expect($grant->scopes)->toEqualCanonicalizing(['user:read']);
    expect($grant->revoked_at)->toBeNull();

    Notification::assertSentTo($user, OAuthGrantCreatedNotification::class);
});

it('NO crea grant si el client no tiene RegisteredApp asociada (PAT / CLI)', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $owner = User::factory()->create();
    $client = makeListenerClient($owner);
    $token = makeListenerToken($user, $client, ['user:read']);

    fireAccessTokenCreated($token);

    expect(OAuthUserGrant::count())->toBe(0);
    Notification::assertNothingSent();
});

it('NO crea grant si la app es first-party', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => true]);
    $client = makeListenerClient($owner, $app);
    $token = makeListenerToken($user, $client);

    fireAccessTokenCreated($token);

    expect(OAuthUserGrant::count())->toBe(0);
    Notification::assertNothingSent();
});

it('NO crea grant para client_credentials (userId nulo)', function (): void {
    Notification::fake();

    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeListenerClient($owner, $app);

    // Simular evento sin userId (client_credentials grant).
    $tokenId = Str::random(80);
    Token::create([
        'id' => $tokenId,
        'user_id' => null,
        'client_id' => $client->id,
        'name' => null,
        'scopes' => [],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);

    event(new AccessTokenCreated(
        tokenId: $tokenId,
        userId: null,
        clientId: $client->id,
    ));

    expect(OAuthUserGrant::count())->toBe(0);
    Notification::assertNothingSent();
});

it('es idempotente: un segundo evento con grant existente NO crea duplicado ni dispara notification', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeListenerClient($owner, $app);

    fireAccessTokenCreated(makeListenerToken($user, $client));
    fireAccessTokenCreated(makeListenerToken($user, $client));

    expect(OAuthUserGrant::query()
        ->where('user_id', $user->id)
        ->where('client_id', $client->id)
        ->count())->toBe(1);

    Notification::assertSentToTimes($user, OAuthGrantCreatedNotification::class, 1);
});

it('reactiva grant revocado y vuelve a notificar al user', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeListenerClient($owner, $app);

    $grant = OAuthUserGrant::factory()
        ->forUser($user)
        ->forClient($client)
        ->revoked()
        ->withScopes(['user:read'])
        ->create();

    fireAccessTokenCreated(makeListenerToken($user, $client, ['user:read']));

    $fresh = $grant->fresh();
    expect($fresh->revoked_at)->toBeNull();
    expect($fresh->scopes)->toEqualCanonicalizing(['user:read']);
    Notification::assertSentTo($user, OAuthGrantCreatedNotification::class);
});

it('mergea scopes nuevos cuando el grant existe activo (incremental consent)', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeListenerClient($owner, $app);

    OAuthUserGrant::factory()
        ->forUser($user)
        ->forClient($client)
        ->withScopes(['user:read'])
        ->create();

    fireAccessTokenCreated(makeListenerToken($user, $client, ['user:read', 'user:email']));

    $grant = OAuthUserGrant::query()
        ->where('user_id', $user->id)
        ->where('client_id', $client->id)
        ->first();

    expect($grant->scopes)->toEqualCanonicalizing(['user:read', 'user:email']);
    expect($grant->updated_scopes_at)->not->toBeNull();
    // No notifica en mere expansión: ya estaba autorizado antes.
    Notification::assertNothingSent();
});

it('llama directamente a handle() con seguridad si el token ya no existe (defensive)', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeListenerClient($owner, $app);

    $listener = app(RecordOAuthGrant::class);
    $listener->handle(new AccessTokenCreated(
        tokenId: 'inexistent-token-id',
        userId: (string) $user->id,
        clientId: $client->id,
    ));

    expect(OAuthUserGrant::count())->toBe(0);
});
