<?php

use App\Enums\GameStatus;
use App\Models\Game;
use App\Models\User;

it('admin ve todos los juegos', function (): void {
    $admin = User::factory()->admin()->create();
    Game::factory()->count(3)->create();

    $response = $this->actingAs($admin)
        ->get(route('admin.games.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/games/index', false)
        ->has('games.data', 3)
    );
});

it('filtra juegos por status', function (): void {
    $admin = User::factory()->admin()->create();
    Game::factory()->count(2)->create(['status' => GameStatus::Published]);
    Game::factory()->count(3)->pendingReview()->create();

    $response = $this->actingAs($admin)
        ->get(route('admin.games.index', ['status' => 'pending_review']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->has('games.data', 3));
});

it('filtra juegos por featured', function (): void {
    $admin = User::factory()->admin()->create();
    Game::factory()->count(2)->featured()->create();
    Game::factory()->count(4)->create(['is_featured' => false]);

    $response = $this->actingAs($admin)
        ->get(route('admin.games.index', ['featured' => '1']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->has('games.data', 2));
});

it('busca juegos por nombre', function (): void {
    $admin = User::factory()->admin()->create();
    Game::factory()->create(['name' => 'Dino Runner']);
    Game::factory()->create(['name' => 'Space Invaders']);

    $response = $this->actingAs($admin)
        ->get(route('admin.games.index', ['search' => 'Dino']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->has('games.data', 1));
});

it('incluye pendingCount en la respuesta', function (): void {
    $admin = User::factory()->admin()->create();
    Game::factory()->count(5)->pendingReview()->create();
    Game::factory()->count(2)->create();

    $response = $this->actingAs($admin)
        ->get(route('admin.games.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->where('pendingCount', 5));
});

it('rechaza a usuarios no admin', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.games.index'))
        ->assertForbidden();
});
