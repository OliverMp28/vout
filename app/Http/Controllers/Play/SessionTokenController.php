<?php

namespace App\Http\Controllers\Play;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\GameSessionTokenIssuer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Renovación del token de una sesión de juego embebido.
 *
 * Un juego dentro del iFrame no puede usar su refresh token (sus cookies
 * no viajan en contexto third-party), así que es el portal quien pide un
 * token nuevo antes de que caduque el anterior y lo reenvía al juego con
 * otro `VOUT_AUTH` (ver `use-game-session.ts`).
 *
 * La autoridad es la sesión web del usuario en Vout: si caducó, el
 * middleware `auth` responde 401; si el usuario revocó la app entretanto,
 * `GameSessionTokenIssuer::issue()` lanza `AuthorizationException` (403).
 */
class SessionTokenController extends Controller
{
    public function store(Request $request, Game $game, GameSessionTokenIssuer $sessions): JsonResponse
    {
        abort_if(! $game->is_active, 404);

        return response()
            ->json($sessions->issue($request->user(), $game)->toArray())
            ->withHeaders([
                'Cache-Control' => 'no-store',
                'Pragma' => 'no-cache',
            ]);
    }
}
