<?php

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Game;
use App\Models\User;

it('elimina un juego permanentemente', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $this->actingAs($admin)
        ->delete(route('admin.games.destroy', $game))
        ->assertRedirect(route('admin.games.index'));

    expect(Game::find($game->id))->toBeNull();
});

it('limpia las relaciones pivote al eliminar', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();
    $categories = Category::factory()->count(2)->create();
    $game->categories()->sync($categories->pluck('id'));

    $this->actingAs($admin)
        ->delete(route('admin.games.destroy', $game));

    expect(Game::find($game->id))->toBeNull();

    // Las relaciones pivote se limpiaron
    $this->assertDatabaseMissing('category_game', [
        'game_id' => $game->id,
    ]);
});

it('crea audit log al eliminar con name y submitter_email', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = User::factory()->create();
    $game = Game::factory()->submittedBy($dev)->create();
    $gameName = $game->name;

    $this->actingAs($admin)
        ->delete(route('admin.games.destroy', $game));

    $log = AuditLog::latest('id')->first();

    expect($log)
        ->admin_id->toBe($admin->id)
        ->action->toBe('game.destroyed');

    expect($log->changes)
        ->toHaveKey('name', $gameName)
        ->toHaveKey('submitter_email', $dev->email);
});

it('rechaza a usuarios no admin', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $this->actingAs($user)
        ->delete(route('admin.games.destroy', $game))
        ->assertForbidden();

    expect(Game::find($game->id))->not->toBeNull();
});
