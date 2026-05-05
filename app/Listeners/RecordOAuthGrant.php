<?php

namespace App\Listeners;

use App\Models\OAuthUserGrant;
use App\Models\RegisteredApp;
use App\Notifications\OAuthGrantCreatedNotification;
use Illuminate\Database\UniqueConstraintViolationException;
use Laravel\Passport\Events\AccessTokenCreated;
use Laravel\Passport\Passport;

/**
 * Mantiene `oauth_user_grants` sincronizado con la creación de access
 * tokens, materializando "el usuario consintió" como un registro propio
 * desacoplado de la vida del token.
 *
 * Filtros tempranos (orden importa por coste y por correctitud):
 *
 *   1. Si el evento no trae `userId` → grant `client_credentials`
 *      (el token vive a nombre del client, no de un humano). No procede.
 *   2. Si no existe `RegisteredApp` para el `clientId` → estamos ante un
 *      Personal Access Token (`PlayController` los crea por cada `/play`)
 *      o un client técnico creado por CLI. Esos no se exponen en
 *      `/settings/connected-apps` ni necesitan tracking de consent.
 *   3. Si la app es first-party (`is_first_party=true`) → fricción cero
 *      ya cubre el skip; no necesitamos persistir grant.
 *
 * El listener es **síncrono** (no implementa `ShouldQueue`). Razón: los
 * tests deben observar el grant inmediatamente tras la respuesta HTTP de
 * `/oauth/authorize`, sin tener que esperar a la cola, y el coste es
 * trivial (un par de queries indexadas). La notificación SÍ es queueable
 * (la dispara el listener pero el envío SMTP/log no bloquea).
 */
class RecordOAuthGrant
{
    public function handle(AccessTokenCreated $event): void
    {
        if ($event->userId === null) {
            return;
        }

        $app = RegisteredApp::query()
            ->where('oauth_client_id', $event->clientId)
            ->first();

        if ($app === null || $app->is_first_party === true) {
            return;
        }

        $token = Passport::token()->find($event->tokenId);

        if ($token === null) {
            return;
        }

        $tokenScopes = is_array($token->scopes) ? $token->scopes : [];

        try {
            $grant = OAuthUserGrant::firstOrCreate(
                [
                    'user_id' => $event->userId,
                    'client_id' => $event->clientId,
                ],
                [
                    'scopes' => $tokenScopes,
                    'granted_at' => now(),
                ],
            );
        } catch (UniqueConstraintViolationException) {
            // Race condition: dos authorizes concurrentes del mismo par.
            // El unique index garantiza que solo uno gana; recargamos.
            $grant = OAuthUserGrant::query()
                ->where('user_id', $event->userId)
                ->where('client_id', $event->clientId)
                ->firstOrFail();
        }

        if ($grant->wasRecentlyCreated) {
            $grant->user?->notify(new OAuthGrantCreatedNotification($grant));

            return;
        }

        // Grant pre-existente: distinguimos reactivación vs incremental.
        if ($grant->revoked_at !== null) {
            $grant->reactivate($tokenScopes);
            $grant->user?->notify(new OAuthGrantCreatedNotification($grant));

            return;
        }

        if (! empty(array_diff($tokenScopes, $grant->scopes ?? []))) {
            $grant->mergeScopes($tokenScopes);
        }
    }
}
