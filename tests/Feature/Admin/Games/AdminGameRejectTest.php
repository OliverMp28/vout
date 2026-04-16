<?php

use App\Enums\GameStatus;
use App\Models\AuditLog;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Notifications\GameRejectedNotification;
use Illuminate\Support\Facades\Notification;

it('rechaza un juego pendiente y persiste el motivo', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $dev = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($dev)->create();
    $game = Game::factory()->forApp($app)->submittedBy($dev)->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.reject', $game), [
            'reason' => 'El embed_url no carga correctamente y falta descripción.',
        ])
        ->assertRedirect();

    $game->refresh();

    expect($game)
        ->status->toBe(GameStatus::Rejected)
        ->rejection_reason->toBe('El embed_url no carga correctamente y falta descripción.');
});

it('crea audit log al rechazar', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.reject', $game), [
            'reason' => 'Contenido inapropiado detectado en la revisión.',
        ]);

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('game.rejected');

    expect($log->changes)->toHaveKey('reason');
});

it('notifica al dev al rechazar', function (): void {
    Notification::fake();
    $admin = User::factory()->admin()->create();
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.reject', $game), [
            'reason' => 'No cumple los requisitos mínimos de calidad.',
        ]);

    Notification::assertSentTo($dev, GameRejectedNotification::class);
});

it('rechaza un juego que no está en pending_review', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create(['status' => GameStatus::Published]);

    $this->actingAs($admin)
        ->post(route('admin.games.reject', $game), [
            'reason' => 'Intento de rechazar un juego publicado.',
        ])
        ->assertStatus(422);
});

it('valida que el motivo sea mínimo 10 caracteres', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.reject', $game), [
            'reason' => 'Corto',
        ])
        ->assertSessionHasErrors('reason');
});

it('valida que el motivo sea obligatorio', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->pendingReview()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.reject', $game), [])
        ->assertSessionHasErrors('reason');
});
