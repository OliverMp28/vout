<?php

namespace App\Http\Controllers\Play;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\GameSessionTokenIssuer;
use App\Services\OAuthConsentRecorder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Consentimiento para juegos embebidos de apps third-party.
 *
 * En el flujo directo, el usuario autoriza la app en `/oauth/authorize`.
 * Dentro del portal no hay redirect OAuth, así que `PlayController`
 * muestra la pantalla `play/consent` y esta acción registra la decisión
 * en `oauth_user_grants` — el mismo registro que crea el flujo directo,
 * visible y revocable en `/settings/connected-apps`.
 *
 * Los scopes concedidos los fija el servidor
 * (`GameSessionTokenIssuer::APP_SCOPES`); nunca se leen de la petición.
 */
class ConsentController extends Controller
{
    public function store(
        Request $request,
        Game $game,
        GameSessionTokenIssuer $sessions,
        OAuthConsentRecorder $consents,
    ): RedirectResponse {
        abort_if(! $game->is_active, 404);

        $user = $request->user();

        if ($sessions->requiresConsent($user, $game)) {
            $consents->record(
                $user->getKey(),
                $game->registeredApp->oauth_client_id,
                GameSessionTokenIssuer::APP_SCOPES,
            );
        }

        return to_route('play.show', $game);
    }
}
