<?php

use App\Models\OAuthUserGrant;
use App\Models\Passport\Client;
use App\Models\RegisteredApp;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Passport\Token;

/*
 * Tests del seed retroactivo (`2026_05_05_000002_seed_oauth_user_grants_from_active_tokens`).
 *
 * Como `RefreshDatabase` ya corre todas las migrations al inicio del test
 * (y por tanto el seed con BD vacía), aquí simulamos manualmente la
 * lógica del seed sobre escenarios pre-cargados para validar todos sus
 * filtros y la deduplicación.
 */

beforeEach(function (): void {
    $this->setUpPassport();

    // Limpiamos los grants creados por el seed automático en BD vacía
    // (no debería haber, pero por seguridad).
    OAuthUserGrant::query()->delete();
});

function makeSeedClient(User $owner, ?RegisteredApp $app = null): Client
{
    $client = Client::create([
        'id' => (string) Str::uuid(),
        'owner_type' => User::class,
        'owner_id' => $owner->id,
        'name' => 'Seed Client',
        'secret' => Str::random(40),
        'redirect_uris' => ['https://seed.test/cb'],
        'grant_types' => ['authorization_code', 'refresh_token'],
        'revoked' => false,
    ]);

    if ($app !== null) {
        $app->forceFill(['oauth_client_id' => $client->id])->save();
    }

    return $client;
}

function runRetroactiveSeed(): void
{
    require_once database_path('migrations/2026_05_05_000002_seed_oauth_user_grants_from_active_tokens.php');

    $migration = require database_path('migrations/2026_05_05_000002_seed_oauth_user_grants_from_active_tokens.php');
    $migration->up();
}

it('crea un grant por par (user, client) con tokens activos third-party', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeSeedClient($owner, $app);

    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);

    runRetroactiveSeed();

    expect(OAuthUserGrant::query()
        ->where('user_id', $user->id)
        ->where('client_id', $client->id)
        ->whereNull('revoked_at')
        ->count())->toBe(1);
});

it('agrupa scopes de múltiples tokens del mismo par en una única fila', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeSeedClient($owner, $app);

    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);
    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:email', 'games:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);

    runRetroactiveSeed();

    $grant = OAuthUserGrant::query()
        ->where('user_id', $user->id)
        ->where('client_id', $client->id)
        ->first();

    expect($grant)->not->toBeNull();
    expect($grant->scopes)->toEqualCanonicalizing(['user:read', 'user:email', 'games:read']);
});

it('NO crea grants para apps first-party', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => true]);
    $client = makeSeedClient($owner, $app);

    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);

    runRetroactiveSeed();

    expect(OAuthUserGrant::count())->toBe(0);
});

it('NO crea grants para clients sin RegisteredApp (PATs)', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $client = makeSeedClient($owner);

    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);

    runRetroactiveSeed();

    expect(OAuthUserGrant::count())->toBe(0);
});

it('NO crea grants para tokens revocados o expirados', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeSeedClient($owner, $app);

    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:read'],
        'revoked' => true,
        'expires_at' => now()->addHour(),
    ]);
    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->subHour(),
    ]);

    runRetroactiveSeed();

    expect(OAuthUserGrant::count())->toBe(0);
});

it('NO crea grants para tokens client_credentials (user_id null)', function (): void {
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeSeedClient($owner, $app);

    DB::table('oauth_access_tokens')->insert([
        'id' => Str::random(80),
        'user_id' => null,
        'client_id' => $client->id,
        'name' => null,
        'scopes' => json_encode([]),
        'revoked' => false,
        'created_at' => now(),
        'updated_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    runRetroactiveSeed();

    expect(OAuthUserGrant::count())->toBe(0);
});

it('es idempotente: ejecutar dos veces no duplica grants', function (): void {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create(['is_first_party' => false]);
    $client = makeSeedClient($owner, $app);

    Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->id,
        'scopes' => ['user:read'],
        'revoked' => false,
        'expires_at' => now()->addHour(),
    ]);

    runRetroactiveSeed();
    runRetroactiveSeed();

    expect(OAuthUserGrant::query()
        ->where('user_id', $user->id)
        ->where('client_id', $client->id)
        ->count())->toBe(1);
});
