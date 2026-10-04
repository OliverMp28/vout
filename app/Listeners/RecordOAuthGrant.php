<?php

namespace App\Listeners;

use App\Models\RegisteredApp;
use App\Services\OAuthConsentRecorder;
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
 * La creación, reactivación y ampliación del grant (y su notificación)
 * viven en `App\Services\OAuthConsentRecorder`, compartido con el
 * consentimiento de juegos embebidos (`Play\ConsentController`).
 *
 * El listener es **síncrono** (no implementa `ShouldQueue`). Razón: los
 * tests deben observar el grant inmediatamente tras la respuesta HTTP de
 * `/oauth/authorize`, sin tener que esperar a la cola, y el coste es
 * trivial (un par de queries indexadas). La notificación SÍ es queueable
 * (la dispara el listener pero el envío SMTP/log no bloquea).
 */
class RecordOAuthGrant
{
    public function __construct(
        private readonly OAuthConsentRecorder $consents,
    ) {}

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

        $this->consents->record(
            $event->userId,
            $event->clientId,
            is_array($token->scopes) ? $token->scopes : [],
        );
    }
}
