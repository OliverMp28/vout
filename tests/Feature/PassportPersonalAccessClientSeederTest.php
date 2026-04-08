<?php

use App\Models\User;
use Database\Seeders\PassportPersonalAccessClientSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\ClientRepository;

uses(RefreshDatabase::class);

// ─── Comportamiento base ──────────────────────────────────────────────────────

it('crea un cliente de acceso personal cuando no existe ninguno', function () {
    expect(DB::table('oauth_clients')->count())->toBe(0);

    $this->seed(PassportPersonalAccessClientSeeder::class);

    expect(DB::table('oauth_clients')
        ->where('revoked', false)
        ->where(fn ($q) => $q->whereNull('provider')->orWhere('provider', 'users'))
        ->where('grant_types', 'LIKE', '%personal_access%')
        ->count()
    )->toBe(1);
});

it('el cliente creado tiene el proveedor users', function () {
    $this->seed(PassportPersonalAccessClientSeeder::class);

    $client = DB::table('oauth_clients')
        ->where('revoked', false)
        ->where('grant_types', 'LIKE', '%personal_access%')
        ->first();

    expect($client)->not->toBeNull();
    expect($client->provider)->toBe('users');
    expect($client->name)->toBe('Vout Personal Access Client');
});

it('permite llamar a createToken tras ejecutar el seeder', function () {
    $this->seed(PassportPersonalAccessClientSeeder::class);

    $user = User::factory()->create();

    // Si el cliente personal no existiera, esto lanzaría RuntimeException.
    $token = $user->createToken('smoke-test', ['game:play']);

    expect($token->accessToken)->toBeString()->not->toBeEmpty();
});

// ─── Idempotencia ─────────────────────────────────────────────────────────────

it('es idempotente: ejecutar el seeder dos veces no crea un segundo cliente', function () {
    $this->seed(PassportPersonalAccessClientSeeder::class);
    $this->seed(PassportPersonalAccessClientSeeder::class);

    expect(DB::table('oauth_clients')
        ->where('revoked', false)
        ->where(fn ($q) => $q->whereNull('provider')->orWhere('provider', 'users'))
        ->where('grant_types', 'LIKE', '%personal_access%')
        ->count()
    )->toBe(1);
});

it('es idempotente con clientes creados por otros medios (eg. artisan passport:client)', function () {
    // Simula que el cliente ya fue creado manualmente antes del seeder.
    app(ClientRepository::class)->createPersonalAccessGrantClient(
        'Cliente previo',
        'users',
    );

    $this->seed(PassportPersonalAccessClientSeeder::class);

    expect(DB::table('oauth_clients')
        ->where('revoked', false)
        ->where(fn ($q) => $q->whereNull('provider')->orWhere('provider', 'users'))
        ->where('grant_types', 'LIKE', '%personal_access%')
        ->count()
    )->toBe(1);
});

it('es idempotente con el cliente creado sin proveedor (setUpPassport de TestCase)', function () {
    // Simula exactamente lo que hace setUpPassport() en TestCase.
    app(ClientRepository::class)->createPersonalAccessGrantClient(
        'Test Personal Access Client',
    );

    $this->seed(PassportPersonalAccessClientSeeder::class);

    // Un cliente provider=null también es compatible con 'users',
    // por lo que el seeder debe detectarlo y NO crear uno duplicado.
    expect(DB::table('oauth_clients')
        ->where('revoked', false)
        ->where(fn ($q) => $q->whereNull('provider')->orWhere('provider', 'users'))
        ->where('grant_types', 'LIKE', '%personal_access%')
        ->count()
    )->toBe(1);
});
