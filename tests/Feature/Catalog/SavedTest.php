<?php

use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('guest es redirigido al login al intentar guardar un juego', function () {
    $game = Game::factory()->create();

    $this->post(route('catalog.saved.toggle', $game))
        ->assertRedirectToRoute('login');
});

it('usuario puede guardar un juego', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $this->actingAs($user)
        ->post(route('catalog.saved.toggle', $game))
        ->assertRedirect();

    expect((bool) $user->games()->find($game)->pivot->is_saved)->toBeTrue();
});

it('usuario puede desguardar un juego', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $user->games()->attach($game, ['is_saved' => true]);

    $this->actingAs($user)
        ->post(route('catalog.saved.toggle', $game))
        ->assertRedirect();

    expect((bool) $user->games()->find($game)->pivot->is_saved)->toBeFalse();
});

it('guardar un juego no afecta el campo is_favorite del mismo registro', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $user->games()->attach($game, ['is_favorite' => true, 'is_saved' => false]);

    $this->actingAs($user)
        ->post(route('catalog.saved.toggle', $game))
        ->assertRedirect();

    expect((bool) $user->games()->find($game)->pivot->is_favorite)->toBeTrue();
});
