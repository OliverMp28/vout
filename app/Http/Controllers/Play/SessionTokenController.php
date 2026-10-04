<?php

namespace App\Http\Controllers\Play;

use App\Http\Controllers\Controller;
use App\Http\Requests\Play\StoreSessionTokenRequest;
use App\Models\Game;
use App\Services\GameSessionTokenIssuer;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Renovación del token de una sesión de juego embebido.
 *
 * Un juego dentro del iFrame no puede usar su refresh token (sus cookies
 * no viajan en contexto third-party), así que es el portal quien pide un
 * token nuevo antes de que caduque el anterior y lo reenvía al juego con
 * otro `VOUT_AUTH` (ver `use-game-session.ts`).
 *
 * La autoridad es la sesión web del usuario en Vout. Respuestas que el
 * portal traduce en el fin de la sesión de juego:
 *
 *   - 401: la sesión web caducó o se cerró (middleware `auth`).
 *   - 403: el usuario revocó la app (`GameSessionTokenIssuer::issue()`).
 *   - 404: el juego ya no está disponible.
 *   - 409: la sesión web pertenece ahora a otra cuenta. La página de juego
 *     se renderizó para un usuario y el navegador tiene la sesión de otro
 *     (cambio de cuenta en otra pestaña): no se emite nada y el portal
 *     recarga la página para rehacer el handshake con la cuenta nueva.
 */
class SessionTokenController extends Controller
{
    public function store(
        StoreSessionTokenRequest $request,
        Game $game,
        GameSessionTokenIssuer $sessions,
    ): JsonResponse {
        abort_if(! $game->is_active, Response::HTTP_NOT_FOUND);

        $user = $request->user();

        abort_if(
            $user->vout_id !== $request->validated('vout_id'),
            Response::HTTP_CONFLICT,
            __('play.session.account_changed'),
        );

        return response()
            ->json($sessions->issue($user, $game)->toArray())
            ->withHeaders([
                'Cache-Control' => 'no-store',
                'Pragma' => 'no-cache',
            ]);
    }
}
