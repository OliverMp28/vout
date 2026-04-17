<?php

use App\Models\Category;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Support\Audit;

it('redirige a login a invitados', function (): void {
    $this->get(route('admin.audit.index'))
        ->assertRedirect(route('login'));
});

it('rechaza a usuarios no admin con 403', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.audit.index'))
        ->assertForbidden();
});

it('lista las entradas paginadas más recientes primero', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    foreach (range(1, 3) as $i) {
        $log = Audit::record($admin, "game.step_{$i}", $game);
        $log->forceFill(['created_at' => now()->subMinutes(3 - $i)])->save();
    }

    $this->actingAs($admin)
        ->get(route('admin.audit.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/audit/index')
            ->has('logs.data', 3)
            ->where('logs.data.0.action', 'game.step_3')
            ->where('logs.data.2.action', 'game.step_1')
        );
});

it('filtra por acción', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    Audit::record($admin, 'game.approved', $game);
    Audit::record($admin, 'game.rejected', $game);
    Audit::record($admin, 'game.approved', $game);

    $this->actingAs($admin)
        ->get(route('admin.audit.index', ['action' => 'game.approved']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 2)
            ->where('filters.action', 'game.approved')
        );
});

it('filtra por admin', function (): void {
    $admin1 = User::factory()->admin()->create();
    $admin2 = User::factory()->admin()->create();
    $game = Game::factory()->create();

    Audit::record($admin1, 'game.approved', $game);
    Audit::record($admin2, 'game.approved', $game);
    Audit::record($admin2, 'game.approved', $game);

    $this->actingAs($admin1)
        ->get(route('admin.audit.index', ['admin_id' => $admin2->id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 2)
            ->where('filters.admin_id', $admin2->id)
        );
});

it('filtra por tipo de recurso usando el nombre corto', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();
    $app = RegisteredApp::factory()->create();
    $category = Category::factory()->create();

    Audit::record($admin, 'game.approved', $game);
    Audit::record($admin, 'app.suspended', $app);
    Audit::record($admin, 'category.created', $category);

    $this->actingAs($admin)
        ->get(route('admin.audit.index', ['auditable_type' => 'RegisteredApp']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.action', 'app.suspended')
            ->where('logs.data.0.auditable.type', 'RegisteredApp')
        );
});

it('filtra por rango de fechas', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $old = Audit::record($admin, 'game.approved', $game);
    $old->forceFill(['created_at' => now()->subDays(10)])->save();

    $recent = Audit::record($admin, 'game.rejected', $game);
    $recent->forceFill(['created_at' => now()->subDay()])->save();

    $this->actingAs($admin)
        ->get(route('admin.audit.index', [
            'from' => now()->subDays(3)->toDateString(),
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.action', 'game.rejected')
        );
});

it('expone cursor next cuando hay más entradas que PAGE_SIZE', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    foreach (range(1, 30) as $i) {
        Audit::record($admin, "game.step_{$i}", $game);
    }

    $this->actingAs($admin)
        ->get(route('admin.audit.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 25)
            ->where('logs.next_cursor', fn ($cursor) => $cursor !== null)
        );
});

it('sólo lista en availableAdmins a quienes han dejado rastro', function (): void {
    $active = User::factory()->admin()->create(['name' => 'Active Admin']);
    User::factory()->admin()->create(['name' => 'Silent Admin']);
    $game = Game::factory()->create();

    Audit::record($active, 'game.approved', $game);

    $this->actingAs($active)
        ->get(route('admin.audit.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('availableAdmins', 1)
            ->where('availableAdmins.0.id', $active->id)
        );
});

it('resuelve el label humano del recurso auditado', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create(['name' => 'Dino Runner']);

    Audit::record($admin, 'game.approved', $game);

    $this->actingAs($admin)
        ->get(route('admin.audit.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('logs.data.0.auditable.label', 'Dino Runner')
            ->where('logs.data.0.auditable.type', 'Game')
        );
});

it('incluye changes y remark en el payload serializado', function (): void {
    $admin = User::factory()->admin()->create();
    $app = RegisteredApp::factory()->create();

    Audit::record(
        admin: $admin,
        action: 'app.suspended',
        auditable: $app,
        changes: ['is_active' => false],
        remark: 'Comportamiento sospechoso detectado.',
    );

    $this->actingAs($admin)
        ->get(route('admin.audit.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('logs.data.0.changes.is_active', false)
            ->where('logs.data.0.remark', 'Comportamiento sospechoso detectado.')
        );
});
