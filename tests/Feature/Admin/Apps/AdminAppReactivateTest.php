<?php

use App\Models\AuditLog;
use App\Models\RegisteredApp;
use App\Models\User;

it('reactiva una app suspendida', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->suspended()->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.reactivate', $app))
        ->assertRedirect();

    $app->refresh();

    expect($app)
        ->is_active->toBeTrue()
        ->suspended_at->toBeNull()
        ->suspension_reason->toBeNull();
});

it('crea audit log al reactivar', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->suspended()->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.reactivate', $app));

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('app.reactivated')
        ->auditable_id->toBe($app->id);
});

it('rechaza reactivar una app que no está suspendida', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.apps.reactivate', $app))
        ->assertStatus(422);
});
