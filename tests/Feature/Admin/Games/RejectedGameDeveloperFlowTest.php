<?php

use App\Enums\GameStatus;
use App\Models\Category;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Notifications\GameApprovedNotification;
use App\Notifications\GameRejectedNotification;
use Illuminate\Support\Facades\Notification;

use function Pest\Laravel\actingAs;

it('dev ve el motivo de rechazo en su dashboard de juegos', function (): void {
    $dev = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($dev)->create([
        'allowed_origins' => ['https://games.test'],
    ]);
    $game = Game::factory()
        ->forApp($app)
        ->submittedBy($dev)
        ->rejected()
        ->create(['rejection_reason' => 'La descripción es insuficiente.']);

    $response = actingAs($dev)->get(route('developers.games.show', $game));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('developers/dashboard/games/show', false)
        ->where('game.rejection_reason', 'La descripción es insuficiente.')
        ->where('game.status', 'rejected')
        ->where('game.is_editable', true)
    );
});

it('flujo completo: submit → reject → edit → resubmit → approve', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $dev = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($dev)->create([
        'allowed_origins' => ['https://games.test'],
    ]);
    $category = Category::factory()->create();

    // 1. Dev envía el juego
    actingAs($dev)->post(route('developers.games.store'), [
        'name' => 'Flow Test Game',
        'description' => str_repeat('Una descripción válida. ', 4),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://games.test/flow',
        'category_ids' => [$category->id],
    ]);

    $game = Game::query()->where('slug', 'flow-test-game')->firstOrFail();
    expect($game->status)->toBe(GameStatus::PendingReview);

    // 2. Admin rechaza
    $this->actingAs($admin)
        ->post(route('admin.games.reject', $game), [
            'reason' => 'Necesita una descripción más detallada del juego.',
        ]);

    $game->refresh();
    expect($game->status)->toBe(GameStatus::Rejected);
    Notification::assertSentTo($dev, GameRejectedNotification::class);

    // 3. Dev edita y reenvía (el update con status=rejected vuelve a pending)
    actingAs($dev)->put(route('developers.games.update', $game), [
        'description' => str_repeat('Descripción mucho más detallada ahora. ', 5),
        'category_ids' => [$category->id],
    ]);

    $game->refresh();
    expect($game->status)->toBe(GameStatus::PendingReview)
        ->and($game->rejection_reason)->toBe('Necesita una descripción más detallada del juego.');

    // 4. Admin aprueba
    $this->actingAs($admin)
        ->post(route('admin.games.approve', $game));

    $game->refresh();
    expect($game->status)->toBe(GameStatus::Published)
        ->and($game->is_active)->toBeTrue()
        ->and($game->rejection_reason)->toBeNull();

    Notification::assertSentTo($dev, GameApprovedNotification::class);
});
