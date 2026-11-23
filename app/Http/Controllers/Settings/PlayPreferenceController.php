<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdatePlayPreferencesRequest;
use Illuminate\Http\Response;

/**
 * Guarda las preferencias de la página de juego (panel abierto, ver la
 * cámara) con la cuenta.
 *
 * Responde 204 sin pasar por Inertia: la página de juego no se recarga (una
 * visita nueva emitiría otro token de sesión y sumaría otra partida).
 */
class PlayPreferenceController extends Controller
{
    public function update(UpdatePlayPreferencesRequest $request): Response
    {
        $user = $request->user();

        $user->settings()
            ->firstOrCreate(['user_id' => $user->id])
            ->update($request->validated());

        return response()->noContent();
    }
}
