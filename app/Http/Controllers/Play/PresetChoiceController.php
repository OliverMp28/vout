<?php

namespace App\Http\Controllers\Play;

use App\Http\Controllers\Controller;
use App\Http\Requests\Play\UpdatePresetChoiceRequest;
use App\Models\Game;
use Illuminate\Http\Response;

/**
 * Recuerda qué controles usa el usuario en un juego que le sugiere los suyos
 * (`suggestedPreset` en el READY): se le pregunta una vez por juego, no en
 * cada partida.
 *
 * Responde 204 sin pasar por Inertia: la página de juego no se recarga (una
 * visita nueva emitiría otro token de sesión y sumaría otra partida).
 */
class PresetChoiceController extends Controller
{
    public function update(UpdatePresetChoiceRequest $request, Game $game): Response
    {
        abort_if(! $game->is_active, 404);

        // La fila de `game_user` puede no existir aún: la crea el job que
        // cuenta la partida, después de la respuesta. Sin tocar el resto.
        $request->user()->games()->syncWithoutDetaching([
            $game->id => ['gesture_preset_choice' => $request->validated('choice')],
        ]);

        return response()->noContent();
    }
}
