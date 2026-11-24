<?php

use App\Models\Category;
use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;

// La portada manda los destacados, los populares y los juegos con gestos
// (primero los hechos para gestos, después los que los admiten).

it('manda los juegos con gestos, primero los hechos para ellos', function () {
    $compatible = Game::factory()->compatibleWithFace()->create(['play_count' => 900]);
    $designed = Game::factory()->designedForFace()->create(['play_count' => 10]);
    Game::factory()->create(['play_count' => 5000]);
    Game::factory()->designedForFace()->inactive()->create();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('welcome')
            ->has('gestureGames.data', 2)
            ->where('gestureGames.data.0.slug', $designed->slug)
            ->where('gestureGames.data.1.slug', $compatible->slug)
        );
});

it('no manda más de cuatro juegos con gestos', function () {
    Game::factory()->count(6)->designedForFace()->create();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('gestureGames.data', 4));
});

it('manda hasta once populares para que la fila siga llena sin los destacados', function () {
    Game::factory()->count(13)->create();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('popular.data', 11));
});

it('sin juegos manda listas vacías', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('featured.data', 0)
            ->has('popular.data', 0)
            ->has('gestureGames.data', 0)
        );
});

it('a quien tiene cuenta le manda sus últimas partidas, la más reciente primero', function () {
    $user = User::factory()->create();
    $older = Game::factory()->create();
    $recent = Game::factory()->create();
    Game::factory()->create();

    $user->games()->attach($older->id, ['last_played_at' => now()->subDays(3), 'play_count' => 1]);
    $user->games()->attach($recent->id, ['last_played_at' => now()->subHour(), 'play_count' => 2]);

    $this->actingAs($user)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('recentGames.data', 2)
            ->where('recentGames.data.0.slug', $recent->slug)
            ->where('recentGames.data.1.slug', $older->slug)
        );
});

it('a un invitado no le manda partidas recientes', function () {
    Game::factory()->create();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('recentGames.data', 0));
});

it('manda los recién llegados y solo las categorías con juegos', function () {
    Cache::forget('catalog:categories:all');
    $withGames = Category::factory()->create();
    Category::factory()->create();
    $old = Game::factory()->create(['created_at' => now()->subMonth()]);
    $new = Game::factory()->create(['created_at' => now()]);
    $new->categories()->attach($withGames);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('newest.data.0.slug', $new->slug)
            ->where('newest.data.1.slug', $old->slug)
            ->has('categories.data', 1)
            ->where('categories.data.0.slug', $withGames->slug)
        );
});
