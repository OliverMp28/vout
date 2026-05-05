<?php

namespace App\Models\Passport;

use App\Models\OAuthUserGrant;
use App\Models\RegisteredApp;
use Illuminate\Contracts\Auth\Authenticatable;
use Laravel\Passport\Client as BaseClient;
use Laravel\Passport\Scope;

class Client extends BaseClient
{
    /**
     * Determine if the client should skip the authorization prompt.
     *
     * Pasos de decisión:
     *
     * 1. Si la `RegisteredApp` vinculada está marcada `is_first_party=true`
     *    → skip incondicional (apps propias del ecosistema, fricción cero).
     * 2. Si no existe `RegisteredApp` (PAT, client técnico, semilla CLI)
     *    → comportamiento default de Passport (mostrar consent si aplica).
     * 3. Third-party con grant activo en `oauth_user_grants` cuyos scopes
     *    cubran los pedidos → skip (paridad Google: autorizó una vez,
     *    recordamos hasta que revoque desde /settings/connected-apps).
     *
     * `prompt=consent` se respeta upstream: Passport
     * (`AuthorizationController.php:75`) cortocircuita ANTES de invocar
     * este método cuando el query param vale `consent`. No hace falta
     * mirar la request aquí.
     *
     * @param  Scope[]|string[]  $scopes
     */
    public function skipsAuthorization(Authenticatable $user, array $scopes): bool
    {
        $app = RegisteredApp::where('oauth_client_id', $this->id)->first();

        if ($app?->is_first_party === true) {
            return true;
        }

        if ($app === null) {
            return false;
        }

        $scopeIds = array_map(
            static fn ($scope): string => $scope instanceof Scope ? $scope->id : (string) $scope,
            $scopes,
        );

        $grant = OAuthUserGrant::query()
            ->active()
            ->where('user_id', $user->getAuthIdentifier())
            ->where('client_id', $this->id)
            ->first();

        return $grant?->coversScopes($scopeIds) ?? false;
    }
}
