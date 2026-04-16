<?php

use App\Models\AuditLog;
use App\Models\Game;
use App\Models\User;

it('activa el featured en un juego', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create(['is_featured' => false]);

    $this->actingAs($admin)
        ->post(route('admin.games.featured', $game))
        ->assertRedirect();

    expect($game->fresh()->is_featured)->toBeTrue();
});

it('desactiva el featured en un juego', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->featured()->create();

    $this->actingAs($admin)
        ->post(route('admin.games.featured', $game))
        ->assertRedirect();

    expect($game->fresh()->is_featured)->toBeFalse();
});

it('crea audit log al alternar featured', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create(['is_featured' => false]);

    $this->actingAs($admin)
        ->post(route('admin.games.featured', $game));

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('game.featured')
        ->auditable_id->toBe($game->id);
});

it('rechaza a usuarios no admin', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $this->actingAs($user)
        ->post(route('admin.games.featured', $game))
        ->assertForbidden();
});
