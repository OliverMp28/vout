<?php

namespace App\Http\Controllers\Play;

use App\Http\Controllers\Controller;
use App\Models\Game;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * "Entrar" desde la página de juego de un invitado.
 *
 * Guarda el juego como destino tras el login (el mismo `url.intended` que
 * usa el middleware `auth`) y manda a la pantalla de entrada. Quien ya ha
 * entrado vuelve directamente al juego.
 */
class SignInController extends Controller
{
    public function __invoke(Request $request, Game $game): RedirectResponse
    {
        abort_if(! $game->is_active, 404);

        if ($request->user() !== null) {
            return to_route('play.show', $game);
        }

        redirect()->setIntendedUrl(route('play.show', $game));

        return to_route('login');
    }
}
