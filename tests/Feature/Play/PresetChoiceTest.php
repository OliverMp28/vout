<?php

use App\Jobs\IncrementGamePlayCount;
use App\Models\Game;
use App\Models\User;

it('guarda los controles elegidos para un juego sin partida previa', function () {
    $user = User::factory()->create();
    $game = Game::factory()->compatibleWithFace()->create();

    $this->actingAs($user)
        ->putJson(route('play.preset.update', $game), ['choice' => 'runner'])
        ->assertNoContent();

    $pivot = $user->games()->where('games.id', $game->id)->first()->pivot;

    expect($pivot->gesture_preset_choice)->toBe('runner')
        ->and((int) $pivot->play_count)->toBe(0);
});

it('actualiza la respuesta sin tocar el resto de la fila', function () {
    $user = User::factory()->create();
    $game = Game::factory()->compatibleWithFace()->create();
    $user->games()->attach($game->id, [
        'play_count' => 4,
        'is_favorite' => true,
        'gesture_preset_choice' => 'runner',
    ]);

    $this->actingAs($user)
        ->putJson(route('play.preset.update', $game), ['choice' => 'own'])
        ->assertNoContent();

    $pivot = $user->games()->where('games.id', $game->id)->first()->pivot;

    expect($pivot->gesture_preset_choice)->toBe('own')
        ->and((int) $pivot->play_count)->toBe(4)
        ->and((bool) $pivot->is_favorite)->toBeTrue();
});

it('no estorba al contador de partidas, que crea la fila después', function () {
    $user = User::factory()->create();
    $game = Game::factory()->compatibleWithFace()->create(['play_count' => 0]);

    $this->actingAs($user)
        ->putJson(route('play.preset.update', $game), ['choice' => 'runner'])
        ->assertNoContent();

    (new IncrementGamePlayCount($user->id, $game->id))->handle();

    $pivot = $user->games()->where('games.id', $game->id)->first()->pivot;

    expect((int) $pivot->play_count)->toBe(1)
        ->and($pivot->gesture_preset_choice)->toBe('runner');
});

it('rechaza una respuesta que no tiene forma de clave', function () {
    $user = User::factory()->create();
    $game = Game::factory()->compatibleWithFace()->create();

    $this->actingAs($user)
        ->putJson(route('play.preset.update', $game), ['choice' => 'Runner; DROP'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('choice');

    $this->actingAs($user)
        ->putJson(route('play.preset.update', $game), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('choice');
});

it('devuelve 404 si el juego no está disponible', function () {
    $user = User::factory()->create();
    $game = Game::factory()->inactive()->create();

    $this->actingAs($user)
        ->putJson(route('play.preset.update', $game), ['choice' => 'runner'])
        ->assertNotFound();
});

it('exige sesión iniciada', function () {
    $game = Game::factory()->create();

    $this->putJson(route('play.preset.update', $game), ['choice' => 'runner'])
        ->assertUnauthorized();
});
