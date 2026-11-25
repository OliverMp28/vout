<?php

use App\Enums\AccountRequirement;
use App\Enums\FacialControlSupport;
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

it('admin puede cambiar si el juego admite el control facial', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'facial_control_support' => 'designed',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($game->fresh()->facial_control_support)->toBe(FacialControlSupport::Designed);
});

it('rechaza un nivel de control facial que no existe', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->compatibleWithFace()->create();

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'facial_control_support' => 'maybe',
        ])
        ->assertSessionHasErrors('facial_control_support');

    expect($game->fresh()->facial_control_support)->toBe(FacialControlSupport::Compatible);
});

it('el detalle del admin muestra si el juego admite el control facial', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->designedForFace()->create();

    $this->actingAs($admin)
        ->get(route('admin.games.show', $game))
        ->assertInertia(fn ($page) => $page
            ->where('game.facial_control_support', 'designed'));
});

it('el admin cambia si hace falta cuenta para jugar y lo ve en el detalle', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'account_requirement' => 'optional',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($game->fresh()->account_requirement)->toBe(AccountRequirement::Optional);

    $this->actingAs($admin)
        ->get(route('admin.games.show', $game))
        ->assertInertia(fn ($page) => $page
            ->where('game.account_requirement', 'optional'));
});

it('rechaza un modo de cuenta que no existe', function (): void {
    $admin = User::factory()->admin()->create();
    $game = Game::factory()->create();

    $this->actingAs($admin)
        ->put(route('admin.games.update', $game), [
            'account_requirement' => 'maybe',
        ])
        ->assertSessionHasErrors('account_requirement');

    expect($game->fresh()->account_requirement)->toBe(AccountRequirement::Required);
});
