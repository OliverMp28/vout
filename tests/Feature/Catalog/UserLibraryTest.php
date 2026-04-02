<?php

use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Favoritos ────────────────────────────────────────────────

it('guest es redirigido al login al acceder a favoritos', function () {
    $this->get(route('library.favorites'))->assertRedirectToRoute('login');
});

it('la página de favoritos muestra solo los juegos marcados como favorito', function () {
    $user = User::factory()->create();
    $favorite = Game::factory()->create(['name' => 'Mi Favorito']);
    $notFavorite = Game::factory()->create(['name' => 'No Favorito']);

    $user->games()->attach($favorite, ['is_favorite' => true]);
    $user->games()->attach($notFavorite, ['is_favorite' => false]);

    $this->actingAs($user)
        ->get(route('library.favorites'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('catalog/library/favorites')
            ->has('games.data', 1)
            ->where('games.data.0.name', 'Mi Favorito')
        );
});

it('la página de favoritos vacía se renderiza correctamente', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('library.favorites'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('games.data', 0));
});

// ─── Guardados ────────────────────────────────────────────────

it('guest es redirigido al login al acceder a guardados', function () {
    $this->get(route('library.saved'))->assertRedirectToRoute('login');
});

it('la página de guardados muestra solo los juegos guardados', function () {
    $user = User::factory()->create();
    $saved = Game::factory()->create(['name' => 'Guardado']);
    $notSaved = Game::factory()->create(['name' => 'Sin Guardar']);

    $user->games()->attach($saved, ['is_saved' => true]);
    $user->games()->attach($notSaved, ['is_saved' => false]);

    $this->actingAs($user)
        ->get(route('library.saved'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('catalog/library/saved')
            ->has('games.data', 1)
            ->where('games.data.0.name', 'Guardado')
        );
});

it('la biblioteca de otro usuario no se mezcla con la propia', function () {
    $userA = User::factory()->create();
    $userB = User::factory()->create();
    $game = Game::factory()->create();

    $userB->games()->attach($game, ['is_favorite' => true]);

    $this->actingAs($userA)
        ->get(route('library.favorites'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('games.data', 0));
});
