<?php

use App\Models\AuditLog;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Notifications\AppSuspendedNotification;
use Illuminate\Support\Facades\Notification;
use Laravel\Passport\Passport;

it('suspende una app y revoca el client OAuth', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->withClient()->create();

    $clientId = $app->oauth_client_id;
    expect($clientId)->not->toBeNull();

    $this->actingAs($admin)
        ->post(route('admin.apps.suspend', $app), [
            'remark' => 'Violación de las políticas de uso del ecosistema.',
        ])
        ->assertRedirect();

    $app->refresh();

    expect($app)
        ->is_active->toBeFalse()
        ->suspended_at->not->toBeNull()
        ->suspension_reason->toBe('Violación de las políticas de uso del ecosistema.')
        ->oauth_client_id->toBeNull();

    // El client OAuth fue revocado
    $client = Passport::client()->newQuery()->find($clientId);
    expect($client->revoked)->toBeTrue();
});

it('crea audit log al suspender', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.suspend', $app), [
            'remark' => 'Motivo de prueba para la suspensión.',
        ]);

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('app.suspended')
        ->auditable_id->toBe($app->id);

    expect($log->changes)->toHaveKey('reason');
});

it('notifica al owner al suspender', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.suspend', $app), [
            'remark' => 'Spam detectado en el uso de la app.',
        ]);

    Notification::assertSentTo($owner, AppSuspendedNotification::class);
});

it('rechaza suspender una app ya suspendida', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->suspended()->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.suspend', $app), [
            'remark' => 'Intento duplicado de suspensión.',
        ])
        ->assertStatus(422);
});

it('valida que el remark sea mínimo 10 caracteres', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.suspend', $app), [
            'remark' => 'Corto',
        ])
        ->assertSessionHasErrors('remark');
});

it('valida que el remark sea obligatorio', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.suspend', $app), [])
        ->assertSessionHasErrors('remark');
});
