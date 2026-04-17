<?php

use App\Enums\GameStatus;
use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Support\Audit;

it('redirige a login a invitados', function (): void {
    $this->get(route('admin.dashboard'))
        ->assertRedirect(route('login'));
});

it('rechaza a usuarios no admin con 403', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.dashboard'))
        ->assertForbidden();
});

it('renderiza el dashboard con todas las métricas del ecosistema', function (): void {
    $admin = User::factory()->admin()->create();

    Game::factory()->count(2)->create(['status' => GameStatus::PendingReview]);
    Game::factory()->count(5)->create(['status' => GameStatus::Published]);

    RegisteredApp::factory()->count(3)->create();
    RegisteredApp::factory()->suspended()->create();

    foreach (range(1, 2) as $i) {
        Developer::factory()->create(['user_id' => User::factory()->create()->id]);
    }
    Developer::factory()->count(4)->create(['user_id' => null]);

    Category::factory()->count(7)->create();

    $this->actingAs($admin)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/dashboard')
            ->where('metrics.gamesPending.value', 2)
            ->where('metrics.gamesPublished.value', 5)
            ->where('metrics.appsActive.value', 3)
            ->where('metrics.appsSuspended.value', 1)
            ->where('metrics.developersClaimed.value', 2)
            ->where('metrics.developersManual.value', 4)
            ->where('metrics.categories.value', 7)
            ->where('metrics.admins.value', 1)
        );
});

it('muestra el feed con las últimas 10 entradas del audit log en orden inverso', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    // Doce entradas — el feed debe quedarse con las 10 más recientes.
    foreach (range(1, 12) as $i) {
        $log = Audit::record($admin, "game.action_{$i}", $game);
        $log->forceFill(['created_at' => now()->subMinutes(12 - $i)])->save();
    }

    $this->actingAs($admin)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('recentActivity', 10)
            ->where('recentActivity.0.action', 'game.action_12')
            ->where('recentActivity.0.admin.id', $admin->id)
        );
});

it('expone un recentActivity vacío cuando no hay entradas en el log', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('recentActivity', 0)
        );
});

it('popula la prop compartida admin.pendingGamesCount sólo en rutas del panel', function (): void {
    $admin = User::factory()->admin()->create();
    Game::factory()->count(3)->create(['status' => GameStatus::PendingReview]);

    $this->actingAs($admin)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('admin.pendingGamesCount', 3)
        );

    // Fuera del panel admin la prop debe ser null para no pagar la query.
    $this->actingAs($admin)
        ->get('/catalog')
        ->assertInertia(fn ($page) => $page->where('admin', null));
});
