<?php

use App\Enums\GameStatus;
use App\Models\AuditLog;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Notifications\GameApprovedNotification;
use Illuminate\Support\Facades\Notification;

it('aprueba un juego pendiente y lo publica', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $dev = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($dev)->create();
    $game = Game::factory()->forApp($app)->submittedBy($dev)->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.approve', $game))
        ->assertRedirect();

    $game->refresh();

    expect($game)
        ->status->toBe(GameStatus::Published)
        ->is_active->toBeTrue()
        ->rejection_reason->toBeNull();
});

it('crea audit log al aprobar', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.approve', $game));

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('game.approved')
        ->auditable_id->toBe($game->id);
});

it('notifica al dev al aprobar', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.approve', $game));

    Notification::assertSentTo($dev, GameApprovedNotification::class);
});

it('rechaza aprobar un juego que no está en pending_review', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create(['status' => GameStatus::Published]);

    $this->actingAs($admin)
        ->post(route('admin.games.approve', $game))
        ->assertStatus(422);
});

it('rechaza a usuarios no admin', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->pendingReview()->create();

    $this->actingAs($user)
        ->post(route('admin.games.approve', $game))
        ->assertForbidden();
});
