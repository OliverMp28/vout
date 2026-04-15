<?php

use App\Models\AuditLog;
use App\Models\User;

it('promueve a un usuario existente como administrador y registra el audit log', function (): void {
    $user = User::factory()->create(['email' => 'dev@example.com']);

    $this->artisan('vout:make-admin', ['email' => 'dev@example.com'])
        ->expectsOutputToContain('Concedido el rol admin para dev@example.com.')
        ->assertSuccessful();

    expect($user->refresh()->is_admin)->toBeTrue()
        ->and(AuditLog::where('action', 'admin.granted')->count())->toBe(1);

    $log = AuditLog::where('action', 'admin.granted')->firstOrFail();

    expect($log->admin_id)->toBeNull()
        ->and($log->auditable_id)->toBe($user->id)
        ->and($log->auditable_type)->toBe(User::class)
        ->and($log->changes)->toBe(['is_admin' => true]);
});

it('revoca el rol admin con la opción --revoke', function (): void {
    $admin = User::factory()->admin()->create(['email' => 'admin@example.com']);

    $this->artisan('vout:make-admin', ['email' => 'admin@example.com', '--revoke' => true])
        ->expectsOutputToContain('Revocado el rol admin para admin@example.com.')
        ->assertSuccessful();

    expect($admin->refresh()->is_admin)->toBeFalse()
        ->and(AuditLog::where('action', 'admin.revoked')->count())->toBe(1);
});

it('falla con un mensaje claro si el email no existe', function (): void {
    $this->artisan('vout:make-admin', ['email' => 'nadie@example.com'])
        ->expectsOutputToContain('No existe un usuario con email nadie@example.com.')
        ->assertFailed();

    expect(AuditLog::count())->toBe(0);
});

it('es idempotente: promover dos veces no genera segundo audit log', function (): void {
    $user = User::factory()->admin()->create(['email' => 'admin@example.com']);

    $this->artisan('vout:make-admin', ['email' => 'admin@example.com'])
        ->expectsOutputToContain('ya es admin')
        ->assertSuccessful();

    expect($user->refresh()->is_admin)->toBeTrue()
        ->and(AuditLog::count())->toBe(0);
});
