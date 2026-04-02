<?php

use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('guest es redirigido al login al intentar marcar favorito', function () {
    $game = Game::factory()->create();

    $this->post(route('catalog.favorite.toggle', $game))
        ->assertRedirectToRoute('login');
});

it('usuario puede marcar un juego como favorito', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $this->actingAs($user)
        ->post(route('catalog.favorite.toggle', $game))
        ->assertRedirect();

    expect((bool) $user->games()->find($game)->pivot->is_favorite)->toBeTrue();
});

it('usuario puede desmarcar un favorito', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $user->games()->attach($game, ['is_favorite' => true]);

    $this->actingAs($user)
        ->post(route('catalog.favorite.toggle', $game))
        ->assertRedirect();

    expect((bool) $user->games()->find($game)->pivot->is_favorite)->toBeFalse();
});

it('marcar favorito no afecta el campo is_saved del mismo registro', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $user->games()->attach($game, ['is_favorite' => false, 'is_saved' => true]);

    $this->actingAs($user)
        ->post(route('catalog.favorite.toggle', $game))
        ->assertRedirect();

    expect((bool) $user->games()->find($game)->pivot->is_saved)->toBeTrue();
});

it('toggle en juego inexistente devuelve 404', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('catalog.favorite.toggle', ['game' => 'no-existe']))
        ->assertNotFound();
});
