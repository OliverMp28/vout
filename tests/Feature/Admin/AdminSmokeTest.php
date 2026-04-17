<?php

use App\Enums\GameStatus;
use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Support\Audit;

/**
 * Smoke test de las rutas GET del Panel de Administración.
 *
 * Verifica que todas las páginas del panel rendericen sin errores
 * 5xx y con el componente Inertia correcto, partiendo de una
 * base de datos con seeders mínimos (una fila por recurso para
 * cubrir rutas show/edit). No reemplaza un smoke de navegador,
 * pero detecta regresiones en controllers/middleware/Inertia.
 */
it('renderiza todas las páginas GET del panel sin 5xx y con el componente Inertia esperado', function (): void {
    $admin = User::factory()->admin()->create();
    $category = Category::factory()->create();
    $developer = Developer::factory()->create();
    $app = RegisteredApp::factory()->create();
    $game = Game::factory()->create(['status' => GameStatus::PendingReview]);

    Audit::record($admin, 'smoke.seed', $game);

    $this->actingAs($admin);

    $routes = [
        ['url' => route('admin.dashboard'), 'component' => 'admin/dashboard'],
        ['url' => route('admin.audit.index'), 'component' => 'admin/audit/index'],
        ['url' => route('admin.apps.index'), 'component' => 'admin/apps/index'],
        ['url' => route('admin.apps.show', $app), 'component' => 'admin/apps/show'],
        ['url' => route('admin.games.index'), 'component' => 'admin/games/index'],
        ['url' => route('admin.games.show', $game), 'component' => 'admin/games/show'],
        ['url' => route('admin.categories.index'), 'component' => 'admin/categories/index'],
        ['url' => route('admin.categories.create'), 'component' => 'admin/categories/create'],
        ['url' => route('admin.categories.edit', $category), 'component' => 'admin/categories/edit'],
        ['url' => route('admin.developers.index'), 'component' => 'admin/developers/index'],
        ['url' => route('admin.developers.create'), 'component' => 'admin/developers/create'],
        ['url' => route('admin.developers.edit', $developer), 'component' => 'admin/developers/edit'],
    ];

    foreach ($routes as $entry) {
        $this->get($entry['url'])
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component($entry['component']));
    }
});

it('la redirección /admin lleva al dashboard como admin', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get('/admin')
        ->assertRedirect(route('admin.dashboard'));
});

it('propaga la prop compartida admin.pendingGamesCount en cada página del panel', function (): void {
    $admin = User::factory()->admin()->create();
    Game::factory()->count(3)->create(['status' => GameStatus::PendingReview]);

    $this->actingAs($admin);

    foreach ([
        route('admin.dashboard'),
        route('admin.apps.index'),
        route('admin.categories.index'),
        route('admin.developers.index'),
        route('admin.audit.index'),
    ] as $url) {
        $this->get($url)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('admin.pendingGamesCount', 3)
            );
    }
});
