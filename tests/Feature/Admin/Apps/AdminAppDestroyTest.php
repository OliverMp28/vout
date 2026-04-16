<?php

use App\Models\AuditLog;
use App\Models\RegisteredApp;
use App\Models\User;
use Laravel\Passport\Passport;

it('elimina una app permanentemente', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create();

    $this->actingAs($admin)
        ->delete(route('admin.apps.destroy', $app))
        ->assertRedirect(route('admin.apps.index'));

    expect(RegisteredApp::find($app->id))->toBeNull();
});

it('revoca el client OAuth al eliminar', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->withClient()->create();
    $clientId = $app->oauth_client_id;

    $this->actingAs($admin)
        ->delete(route('admin.apps.destroy', $app));

    expect(Passport::client()->newQuery()->find($clientId))->toBeNull();
});

it('crea audit log al eliminar con name y owner_email', function (): void {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();
    $appName = $app->name;

    $this->actingAs($admin)
        ->delete(route('admin.apps.destroy', $app));

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('app.destroyed');

    expect($log->changes)
        ->toHaveKey('name', $appName)
        ->toHaveKey('owner_email', $owner->email);
});

it('rechaza a usuarios no admin', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->create();

    $this->actingAs($user)
        ->delete(route('admin.apps.destroy', $app))
        ->assertForbidden();

    expect(RegisteredApp::find($app->id))->not->toBeNull();
});
