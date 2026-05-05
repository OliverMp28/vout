<?php

use App\Models\OAuthUserGrant;
use App\Models\Passport\Client;
use App\Models\User;
use Illuminate\Support\Str;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;

/*
 * Tests unitarios del modelo OAuthUserGrant.
 *
 * Cubren los métodos puros (coversScopes, mergeScopes, reactivate) y
 * la cascada de revoke sobre tokens. No tocan el flujo OAuth real ni
 * el listener — eso se valida en tests posteriores.
 */

function makeGrantClient(?User $user = null): Client
{
    $user ??= User::factory()->create();

    return Client::create([
        'id' => (string) Str::uuid(),
        'owner_type' => User::class,
        'owner_id' => $user->id,
        'name' => 'Grant Test Client',
        'secret' => Str::random(40),
        'redirect_uris' => ['https://example.test/cb'],
        'grant_types' => ['authorization_code', 'refresh_token'],
        'revoked' => false,
    ]);
}

it('coversScopes devuelve true cuando los scopes solicitados son subset', function (): void {
    $grant = OAuthUserGrant::factory()
        ->withScopes(['user:read', 'user:email'])
        ->create(['client_id' => makeGrantClient()->id]);

    expect($grant->coversScopes(['user:read']))->toBeTrue();
    expect($grant->coversScopes(['user:read', 'user:email']))->toBeTrue();
    expect($grant->coversScopes([]))->toBeTrue();
});

it('coversScopes devuelve false si pide un scope nuevo no almacenado', function (): void {
    $grant = OAuthUserGrant::factory()
        ->withScopes(['user:read'])
        ->create(['client_id' => makeGrantClient()->id]);

    expect($grant->coversScopes(['user:read', 'user:email']))->toBeFalse();
    expect($grant->coversScopes(['games:write']))->toBeFalse();
});

it('mergeScopes une scopes nuevos sin duplicar y marca updated_scopes_at', function (): void {
    $grant = OAuthUserGrant::factory()
        ->withScopes(['user:read'])
        ->create(['client_id' => makeGrantClient()->id, 'updated_scopes_at' => null]);

    $grant->mergeScopes(['user:read', 'user:email']);

    expect($grant->fresh()->scopes)->toEqualCanonicalizing(['user:read', 'user:email']);
    expect($grant->fresh()->updated_scopes_at)->not->toBeNull();
});

it('scope active filtra grants revocados', function (): void {
    $client = makeGrantClient();

    OAuthUserGrant::factory()->create(['client_id' => $client->id]);
    OAuthUserGrant::factory()->revoked()->create([
        'client_id' => makeGrantClient()->id,
    ]);

    expect(OAuthUserGrant::active()->count())->toBe(1);
    expect(OAuthUserGrant::count())->toBe(2);
});

it('revoke marca revoked_at y revoca todos los access/refresh tokens del par', function (): void {
    $user = User::factory()->create();
    $client = makeGrantClient($user);

    $grant = OAuthUserGrant::factory()
        ->forUser($user)
        ->forClient($client)
        ->create();

    $token = Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
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

    $grant->revoke();

    expect($grant->fresh()->revoked_at)->not->toBeNull();
    expect($token->fresh()->revoked)->toBeTrue();
    expect($refresh->fresh()->revoked)->toBeTrue();
});

it('revoke no toca tokens de otros pares (user, client)', function (): void {
    $userA = User::factory()->create();
    $userB = User::factory()->create();
    $clientA = makeGrantClient($userA);
    $clientB = makeGrantClient($userB);

    $grantA = OAuthUserGrant::factory()
        ->forUser($userA)
        ->forClient($clientA)
        ->create();

    $foreignToken = Token::create([
        'id' => Str::random(80),
        'user_id' => $userB->id,
        'client_id' => $clientB->id,
        'name' => null,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);

    $grantA->revoke();

    expect($foreignToken->fresh()->revoked)->toBeFalse();
});

it('reactivate limpia revoked_at y resetea timestamps', function (): void {
    $grant = OAuthUserGrant::factory()
        ->revoked()
        ->withScopes(['user:read'])
        ->create(['client_id' => makeGrantClient()->id]);

    $grant->reactivate(['user:read', 'games:read']);

    $fresh = $grant->fresh();
    expect($fresh->revoked_at)->toBeNull();
    expect($fresh->scopes)->toEqualCanonicalizing(['user:read', 'games:read']);
    expect($fresh->updated_scopes_at)->not->toBeNull();
});
