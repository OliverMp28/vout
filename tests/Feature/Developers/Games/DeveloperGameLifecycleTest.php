<?php

use App\Enums\GameStatus;
use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;

use function Pest\Laravel\actingAs;

function lifecycleApp(User $user): RegisteredApp
{
    return RegisteredApp::factory()->forUser($user)->create([
        'allowed_origins' => ['https://games.test'],
    ]);
}

it('lista únicamente los juegos del propio dev', function (): void {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $app = lifecycleApp($user);
    Game::factory()->submittedBy($user)->forApp($app)->pendingReview()->create();
    Game::factory()->submittedBy($other)->pendingReview()->create();

    actingAs($user)
        ->get(route('developers.games.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('developers/dashboard/games/index')
            ->has('games', 1));
});

it('actualiza campos editables y sincroniza categorías y developers', function (): void {
    $user = User::factory()->create();
    $app = lifecycleApp($user);
    $game = Game::factory()->submittedBy($user)->forApp($app)->pendingReview()->create([
        'embed_url' => 'https://games.test/v1',
    ]);
    $oldCategory = Category::factory()->create();
    $newCategory = Category::factory()->create();
    $developer = Developer::factory()->create();
    $game->categories()->sync([$oldCategory->id]);

    actingAs($user)->put(route('developers.games.update', $game), [
        'name' => 'Renombrado',
        'description' => str_repeat('descripción suficiente ', 3),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://games.test/v2',
        'category_ids' => [$newCategory->id],
        'developer_ids' => [$developer->id],
    ])->assertRedirect(route('developers.games.show', $game));

    $game->refresh();

    expect($game->name)->toBe('Renombrado')
        ->and($game->embed_url)->toBe('https://games.test/v2')
        ->and($game->categories->pluck('id')->all())->toBe([$newCategory->id])
        ->and($game->developers->pluck('id')->all())->toBe([$developer->id]);
});

it('re-encola un juego rechazado al guardar cambios', function (): void {
    $user = User::factory()->create();
    $app = lifecycleApp($user);
    $game = Game::factory()->submittedBy($user)->forApp($app)->rejected()->create();
    $category = Category::factory()->create();

    actingAs($user)->put(route('developers.games.update', $game), [
        'name' => $game->name,
        'description' => str_repeat('descripción suficiente ', 3),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://games.test/r',
        'category_ids' => [$category->id],
    ])->assertRedirect();

    expect($game->fresh()->status)->toBe(GameStatus::PendingReview);
});

it('permite eliminar un juego mientras su estado lo permita', function (): void {
    $user = User::factory()->create();
    $app = lifecycleApp($user);
    $game = Game::factory()->submittedBy($user)->forApp($app)->pendingReview()->create();

    actingAs($user)->delete(route('developers.games.destroy', $game))
        ->assertRedirect(route('developers.games.index'));

    expect(Game::query()->find($game->id))->toBeNull();
});

it('bloquea eliminar un juego publicado (policy)', function (): void {
    $user = User::factory()->create();
    $app = lifecycleApp($user);
    $game = Game::factory()->submittedBy($user)->forApp($app)->create([
        'status' => GameStatus::Published,
    ]);

    actingAs($user)->delete(route('developers.games.destroy', $game))
        ->assertForbidden();

    expect(Game::query()->find($game->id))->not->toBeNull();
});

it('un extraño recibe 403 al intentar ver un juego ajeno', function (): void {
    $owner = User::factory()->create();
    $stranger = User::factory()->create();
    $app = lifecycleApp($owner);
    $game = Game::factory()->submittedBy($owner)->forApp($app)->pendingReview()->create();

    actingAs($stranger)->get(route('developers.games.show', $game))
        ->assertForbidden();
});
