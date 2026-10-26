<?php

use App\Models\AuditLog;
use App\Models\RegisteredApp;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Laravel\Passport\Client;

function registerDaino(array $overrides = []): array
{
    return [
        'name' => 'Daino',
        '--owner' => 'owner@example.com',
        '--url' => 'https://daino.vout.cloud',
        '--origin' => ['https://daino.vout.cloud'],
        '--redirect' => ['https://daino.vout.cloud/auth/callback'],
        ...$overrides,
    ];
}

it('registra la app con un client confidencial y muestra sus credenciales una vez', function (): void {
    $owner = User::factory()->create(['email' => 'owner@example.com']);

    $this->artisan('vout:register-app', registerDaino())
        ->expectsOutputToContain('VOUT_CLIENT_ID=')
        ->expectsOutputToContain('VOUT_CLIENT_SECRET=')
        ->assertSuccessful();

    $app = RegisteredApp::query()->where('slug', 'daino')->firstOrFail();
    $client = Client::query()->findOrFail($app->oauth_client_id);

    expect($app->user_id)->toBe($owner->id)
        ->and($app->is_first_party)->toBeFalse()
        ->and($app->requires_auth)->toBeTrue()
        ->and($app->allowed_origins)->toBe(['https://daino.vout.cloud'])
        ->and($client->redirect_uris)->toBe(['https://daino.vout.cloud/auth/callback'])
        ->and($client->grant_types)->toContain('authorization_code')
        ->and($client->confidential())->toBeTrue()
        ->and(AuditLog::where('action', 'app.registered')->count())->toBe(1);
});

it('el secreto mostrado es el que valida Passport', function (): void {
    User::factory()->create(['email' => 'owner@example.com']);

    $this->withoutMockingConsoleOutput();
    Artisan::call('vout:register-app', registerDaino());

    $output = Artisan::output();
    preg_match('/VOUT_CLIENT_SECRET=(\S+)/', $output, $matches);

    $client = Client::query()->findOrFail(RegisteredApp::query()->where('slug', 'daino')->value('oauth_client_id'));

    expect(Hash::check($matches[1], $client->secret))->toBeTrue();
});

it('admite clients públicos y apps first-party', function (): void {
    User::factory()->create(['email' => 'owner@example.com']);

    $this->artisan('vout:register-app', registerDaino(['--public' => true, '--first-party' => true]))
        ->doesntExpectOutputToContain('VOUT_CLIENT_SECRET=')
        ->assertSuccessful();

    $app = RegisteredApp::query()->where('slug', 'daino')->firstOrFail();

    expect($app->is_first_party)->toBeTrue()
        ->and(Client::query()->findOrFail($app->oauth_client_id)->confidential())->toBeFalse();
});

it('rechaza un redirect fuera de los orígenes permitidos sin crear nada', function (): void {
    User::factory()->create(['email' => 'owner@example.com']);

    $this->artisan('vout:register-app', registerDaino(['--redirect' => ['https://evil.example/callback']]))
        ->expectsOutputToContain('no pertenece a ningún origen permitido')
        ->assertFailed();

    expect(RegisteredApp::count())->toBe(0);
});

it('falla si el dueño no existe', function (): void {
    $this->artisan('vout:register-app', registerDaino())
        ->expectsOutputToContain('No existe un usuario con ese email')
        ->assertFailed();
});
