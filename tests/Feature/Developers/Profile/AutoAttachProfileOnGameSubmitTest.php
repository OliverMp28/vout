<?php

use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;

use function Pest\Laravel\actingAs;

function gameBaseForProfileTest(User $user): array
{
    $app = RegisteredApp::factory()->forUser($user)->create([
        'allowed_origins' => ['https://games.test'],
    ]);

    return [
        'name' => 'Profile Test Game',
        'description' => str_repeat('Descripción mínima. ', 4),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://games.test/play',
        'category_ids' => [Category::factory()->create()->id],
    ];
}

it('auto-adjunta la ficha del dev al crear un juego aunque no venga en developer_ids', function (): void {
    $user = User::factory()->create();
    $profile = Developer::factory()->create(['user_id' => $user->id]);

    actingAs($user)->post(route('developers.games.store'), gameBaseForProfileTest($user));

    $game = Game::query()->where('submitted_by_user_id', $user->id)->firstOrFail();

    expect($game->developers->pluck('id')->all())->toContain($profile->id);
});

it('no duplica la ficha propia si el dev la incluye manualmente', function (): void {
    $user = User::factory()->create();
    $profile = Developer::factory()->create(['user_id' => $user->id]);

    $payload = array_merge(gameBaseForProfileTest($user), [
        'developer_ids' => [$profile->id],
    ]);

    actingAs($user)->post(route('developers.games.store'), $payload);

    $game = Game::query()->where('submitted_by_user_id', $user->id)->firstOrFail();

    expect($game->developers()->where('developers.id', $profile->id)->count())->toBe(1);
});

it('reinyecta la ficha propia al actualizar aunque el cliente no la envíe', function (): void {
    $user = User::factory()->create();
    $profile = Developer::factory()->create(['user_id' => $user->id]);
    $other = Developer::factory()->create();

    actingAs($user)->post(route('developers.games.store'), gameBaseForProfileTest($user));
    $game = Game::query()->where('submitted_by_user_id', $user->id)->firstOrFail();

    actingAs($user)->put(route('developers.games.update', $game), array_merge(
        gameBaseForProfileTest($user),
        [
            'registered_app_id' => $game->registered_app_id,
            'developer_ids' => [$other->id],
        ],
    ));

    $ids = $game->fresh()->developers->pluck('id')->all();
    expect($ids)->toContain($profile->id)->and($ids)->toContain($other->id);
});

it('si el dev no ha reclamado su ficha, no adjunta nada extra', function (): void {
    $user = User::factory()->create();

    actingAs($user)->post(route('developers.games.store'), gameBaseForProfileTest($user));

    $game = Game::query()->where('submitted_by_user_id', $user->id)->firstOrFail();

    expect($game->developers)->toHaveCount(0);
});
