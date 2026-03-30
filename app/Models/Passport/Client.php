<?php

namespace App\Models\Passport;

use App\Models\RegisteredApp;
use Illuminate\Contracts\Auth\Authenticatable;
use Laravel\Passport\Client as BaseClient;

class Client extends BaseClient
{
    /**
     * Determine if the client should skip the authorization prompt.
     *
     * @param  Authenticatable  $user
     * @param  array  $scopes
     * @return bool
     */
    public function skipsAuthorization(Authenticatable $user, array $scopes): bool
    {
        // Lógica Fricción Cero:
        // Si la RegisteredApp vinculada a este Client ID está marcada como "first_party" (desarrollada por ti), 
        // pasará directamente sin requerir que el usuario acepte manualmente.
        $app = RegisteredApp::where('oauth_client_id', $this->id)->first();
        
        return $app?->is_first_party ?? false;
    }
}
