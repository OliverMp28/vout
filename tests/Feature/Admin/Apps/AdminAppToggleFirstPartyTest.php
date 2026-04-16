<?php

use App\Models\AuditLog;
use App\Models\RegisteredApp;
use App\Models\User;

it('alterna el badge first-party a true', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create(['is_first_party' => false]);

    $this->actingAs($admin)
        ->post(route('admin.apps.first-party', $app))
        ->assertRedirect();

    expect($app->fresh()->is_first_party)->toBeTrue();
});

it('alterna el badge first-party a false', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create(['is_first_party' => true]);

    $this->actingAs($admin)
        ->post(route('admin.apps.first-party', $app))
        ->assertRedirect();

    expect($app->fresh()->is_first_party)->toBeFalse();
});

it('crea una entrada de audit log al alternar first-party', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create(['is_first_party' => false]);

    $this->actingAs($admin)
        ->post(route('admin.apps.first-party', $app));

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('app.marked_first_party')
        ->auditable_type->toBe(RegisteredApp::class)
        ->auditable_id->toBe($app->id);
});

it('rechaza a usuarios no admin', function (): void {
    $user = User::factory()->create();
    $app = RegisteredApp::factory()->create();

    $this->actingAs($user)
        ->post(route('admin.apps.first-party', $app))
        ->assertForbidden();
});
