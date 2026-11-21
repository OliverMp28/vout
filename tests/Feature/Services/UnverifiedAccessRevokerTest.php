<?php

use App\Models\OAuthUserGrant;
use App\Models\Passport\Client;
use App\Models\User;
use App\Services\UnverifiedAccessRevoker;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;

/*
 * Retirada de accesos al unir Google con una cuenta cuyo email nadie
 * había confirmado (pre-secuestro de cuenta).
 */

function revokerClient(User $owner): Client
{
    return Client::create([
        'id' => (string) Str::uuid(),
        'owner_type' => User::class,
        'owner_id' => $owner->id,
        'name' => 'Revoker Test Client',
        'secret' => Str::random(40),
        'redirect_uris' => ['https://example.test/cb'],
        'grant_types' => ['authorization_code', 'refresh_token'],
        'revoked' => false,
    ]);
}

function revokerToken(User $user, Client $client): Token
{
    return Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'name' => null,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);
}

it('invalida contraseña, 2FA y recordarme de la cuenta', function () {
    $user = User::factory()->unverified()->create([
        'password' => 'contraseña-del-intruso',
        'remember_token' => 'token-del-intruso',
        'two_factor_secret' => encrypt('secreto'),
        'two_factor_recovery_codes' => encrypt(json_encode(['codigo'])),
        'two_factor_confirmed_at' => now(),
    ]);

    app(UnverifiedAccessRevoker::class)->revoke($user);

    $user->refresh();
    expect(Hash::check('contraseña-del-intruso', $user->password))->toBeFalse()
        ->and($user->remember_token)->not->toBe('token-del-intruso')
        ->and($user->two_factor_secret)->toBeNull()
        ->and($user->two_factor_recovery_codes)->toBeNull()
        ->and($user->two_factor_confirmed_at)->toBeNull();
});

it('revoca las apps autorizadas y todos los tokens de la cuenta', function () {
    $user = User::factory()->unverified()->create();
    $client = revokerClient(User::factory()->create());

    $grant = OAuthUserGrant::factory()->forUser($user)->forClient($client)->create();
    $token = revokerToken($user, $client);
    $refresh = RefreshToken::create([
        'id' => Str::random(80),
        'access_token_id' => $token->id,
        'revoked' => false,
        'expires_at' => now()->addDays(30),
    ]);

    $other = User::factory()->create();
    $otherToken = revokerToken($other, $client);

    app(UnverifiedAccessRevoker::class)->revoke($user);

    expect($grant->fresh()->revoked_at)->not->toBeNull()
        ->and($token->fresh()->revoked)->toBeTrue()
        ->and($refresh->fresh()->revoked)->toBeTrue()
        ->and($otherToken->fresh()->revoked)->toBeFalse();
});

it('cierra las sesiones web de la cuenta con el driver database', function () {
    config(['session.driver' => 'database']);

    $user = User::factory()->unverified()->create();
    $other = User::factory()->create();

    foreach ([$user, $other] as $owner) {
        DB::table('sessions')->insert([
            'id' => Str::random(40),
            'user_id' => $owner->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);
    }

    app(UnverifiedAccessRevoker::class)->revoke($user);

    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $other->id)->count())->toBe(1);
});
