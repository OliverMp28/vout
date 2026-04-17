<?php

use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(fn () => test()->withoutVite());

// Registrar el cliente personal de Passport antes de cada test.
// PlayController llama a $user->createToken(), que requiere un cliente personal
// en la BD. Con RefreshDatabase los clientes se limpian entre tests.
beforeEach(fn () => test()->setUpPassport());

// ─── Acceso y autenticación ───────────────────────────────────

it('redirige al login si el usuario no está autenticado', function () {
    $game = Game::factory()->create(['is_active' => true]);

    $this->get(route('play.show', $game))
        ->assertRedirect(route('login'));
});

// ─── Respuesta correcta ───────────────────────────────────────

it('devuelve 200 y renderiza el componente play/game', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('play/game', false));
});

it('devuelve 404 para juegos inactivos', function () {
    $user = User::factory()->create();
    $game = Game::factory()->inactive()->create();

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertNotFound();
});

it('devuelve 404 para slugs inexistentes', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('play.show', 'slug-que-no-existe'))
        ->assertNotFound();
});

// ─── Props Inertia: datos del juego ──────────────────────────

it('incluye las props correctas del juego en la respuesta Inertia', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create([
        'is_active' => true,
        'embed_url' => 'https://dino.vout.com/play',
        'description' => 'Un juego de prueba.',
    ]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('game')
            ->where('game.slug', $game->slug)
            ->where('game.name', $game->name)
            ->where('game.embed_url', $game->embed_url)
            ->where('game.description', $game->description)
        );
});

it('incluye effective_origins derivado de embed_url', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create([
        'is_active' => true,
        'embed_url' => 'https://dino.vout.com/play',
    ]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('game.effective_origins', ['https://dino.vout.com'])
        );
});

// ─── Props Inertia: access token ─────────────────────────────

it('incluye un access token para el usuario autenticado', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('accessToken')
            ->whereType('accessToken', 'string')
        );
});

// ─── Props Inertia: configuración de gestos ──────────────────

it('incluye activeGestureConfig null si el usuario no tiene configuración activa', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('activeGestureConfig', null)
        );
});

it('incluye activeGestureConfig con los datos correctos si el usuario tiene una activa', function () {
    $user = User::factory()->create();
    $config = GestureConfig::factory()->for($user)->create(['is_active' => true]);
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('activeGestureConfig')
            ->where('activeGestureConfig.id', $config->id)
        );
});

it('solo devuelve la config activa cuando el usuario tiene varias', function () {
    $user = User::factory()->create();
    $inactive = GestureConfig::factory()->for($user)->create(['is_active' => false]);
    $active = GestureConfig::factory()->for($user)->create(['is_active' => true]);
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('activeGestureConfig.id', $active->id)
        );
});

// ─── Fase 3.4: registro de partida (play_count + last_played_at) ──

it('crea la fila pivote game_user con play_count=1 en la primera visita', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    expect($user->games()->count())->toBe(0);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk();

    $pivot = $user->games()->where('game_id', $game->id)->first()?->pivot;

    expect($pivot)->not->toBeNull()
        ->and($pivot->play_count)->toBe(1)
        ->and($pivot->last_played_at)->not->toBeNull();
});

it('incrementa play_count y refresca last_played_at en visitas sucesivas', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $oldTimestamp = now()->subHour();
    $user->games()->attach($game->id, [
        'play_count' => 3,
        'last_played_at' => $oldTimestamp,
        'is_favorite' => true,
        'best_score' => 999,
    ]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk();

    $pivot = $user->games()->where('game_id', $game->id)->first()->pivot;

    expect($pivot->play_count)->toBe(4)
        ->and(Carbon::parse($pivot->last_played_at)->greaterThan($oldTimestamp))->toBeTrue()
        ->and((bool) $pivot->is_favorite)->toBeTrue()
        ->and($pivot->best_score)->toBe(999);
});

it('no crea fila pivote si un guest accede al reproductor', function () {
    $game = Game::factory()->create(['is_active' => true]);

    $this->get(route('play.show', $game))
        ->assertRedirect(route('login'));

    expect(DB::table('game_user')->count())->toBe(0);
});
