<?php

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Game;
use App\Models\User;

it('admin puede editar campos de cualquier juego', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create(['name' => 'Typo Gaem']);

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'name' => 'Typo Game',
        ])
        ->assertRedirect();

    expect($game->fresh()->name)->toBe('Typo Game');
});

it('admin puede sincronizar categorías', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();
    $categories = Category::factory()->count(2)->create();

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'category_ids' => $categories->pluck('id')->all(),
        ])
        ->assertRedirect();

    expect($game->fresh()->categories->pluck('id')->sort()->values()->all())
        ->toBe($categories->pluck('id')->sort()->values()->all());
});

it('crea audit log al actualizar', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'name' => 'Updated Name',
        ]);

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('game.updated')
        ->auditable_id->toBe($game->id);
});

it('valida reglas de actualización', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'name' => 'A', // min:2
            'description' => 'short', // min:20
        ])
        ->assertSessionHasErrors(['name', 'description']);
});

it('rechaza a usuarios no admin', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $this->actingAs($user)
        ->put(route('admin.games.update', $game), [
            'name' => 'Hack Attempt',
        ])
        ->assertForbidden();
});
