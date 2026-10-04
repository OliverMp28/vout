<?php

namespace App\Services;

use App\Models\OAuthUserGrant;
use App\Notifications\OAuthGrantCreatedNotification;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Materializa "el usuario autorizó esta app con estos scopes" en
 * `oauth_user_grants`.
 *
 * Única fuente de verdad para los dos caminos por los que un usuario
 * puede autorizar una app third-party:
 *
 *   - Flujo OAuth directo: `App\Listeners\RecordOAuthGrant` lo invoca al
 *     emitirse un access token tras la pantalla de `/oauth/authorize`.
 *   - Juego embebido: `App\Http\Controllers\Play\ConsentController` lo
 *     invoca cuando el usuario acepta en `/play/{game}`.
 *
 * Decidir si un client debe o no generar grant (first-party, PAT,
 * `client_credentials`) es responsabilidad de quien llama.
 */
class OAuthConsentRecorder
{
    /**
     * Crea el grant, lo reactiva si estaba revocado o amplía sus scopes.
     *
     * Notifica al usuario solo cuando la app gana acceso (primer grant o
     * reactivación), no en una mera ampliación de scopes.
     *
     * @param  array<int, string>  $scopes
     */
    public function record(int|string $userId, string $clientId, array $scopes): OAuthUserGrant
    {
        try {
            $grant = OAuthUserGrant::firstOrCreate(
                [
                    'user_id' => $userId,
                    'client_id' => $clientId,
                ],
                [
                    'scopes' => $scopes,
                    'granted_at' => now(),
                ],
            );
        } catch (UniqueConstraintViolationException) {
            // Race condition: dos autorizaciones concurrentes del mismo par.
            // El unique index garantiza que solo una gana; recargamos.
            $grant = OAuthUserGrant::query()
                ->where('user_id', $userId)
                ->where('client_id', $clientId)
                ->firstOrFail();
        }

        if ($grant->wasRecentlyCreated) {
            $grant->user?->notify(new OAuthGrantCreatedNotification($grant));

            return $grant;
        }

        if ($grant->revoked_at !== null) {
            $grant->reactivate($scopes);
            $grant->user?->notify(new OAuthGrantCreatedNotification($grant));

            return $grant;
        }

        if (! empty(array_diff($scopes, $grant->scopes ?? []))) {
            $grant->mergeScopes($scopes);
        }

        return $grant;
    }
}
