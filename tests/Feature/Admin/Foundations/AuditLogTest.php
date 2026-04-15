<?php

use App\Models\AuditLog;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Support\Audit;

it('Audit::record persiste la entrada con admin, acción, recurso y cambios', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->forUser(User::factory()->create())->create();

    $log = Audit::record(
        admin: $admin,
        action: 'app.suspended',
        auditable: $app,
        changes: ['is_active' => false, 'suspended_at' => now()->toIso8601String()],
        remark: 'Spam reportado por usuarios.',
    );

    expect($log)->toBeInstanceOf(AuditLog::class)
        ->and($log->admin_id)->toBe($admin->id)
        ->and($log->action)->toBe('app.suspended')
        ->and($log->auditable_type)->toBe(RegisteredApp::class)
        ->and($log->auditable_id)->toBe($app->id)
        ->and($log->changes)->toMatchArray(['is_active' => false])
        ->and($log->remark)->toBe('Spam reportado por usuarios.');
});

it('admite admin nulo para acciones disparadas desde CLI', function (): void {
    $user = User::factory()->create();

    $log = Audit::record(
        admin: null,
        action: 'admin.granted',
        auditable: $user,
        changes: ['is_admin' => true],
    );

    expect($log->admin_id)->toBeNull()
        ->and($log->changes)->toBe(['is_admin' => true]);
});

it('cuando no se pasan changes guarda null en la columna', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $log = Audit::record($admin, 'game.featured.toggled', $game);

    expect($log->changes)->toBeNull()
        ->and($log->remark)->toBeNull();
});

it('la relación auditable() resuelve el recurso polimórfico', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $log = Audit::record($admin, 'game.approved', $game);

    expect($log->auditable)->toBeInstanceOf(Game::class)
        ->and($log->auditable->id)->toBe($game->id);
});

it('la relación admin() devuelve el usuario administrador', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $log = Audit::record($admin, 'game.approved', $game);

    expect($log->admin)->not->toBeNull()
        ->and($log->admin->id)->toBe($admin->id);
});

it('no expone un updated_at: el log es inmutable', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();
    $log = Audit::record($admin, 'game.approved', $game);

    expect($log->updated_at)->toBeNull();
});

it('el scope recent() ordena por created_at descendente', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $first = Audit::record($admin, 'game.approved', $game);
    $first->forceFill(['created_at' => now()->subMinutes(5)])->save();
    $second = Audit::record($admin, 'game.featured.toggled', $game);

    $ordered = AuditLog::recent()->pluck('id')->all();

    expect($ordered[0])->toBe($second->id)
        ->and($ordered[1])->toBe($first->id);
});
