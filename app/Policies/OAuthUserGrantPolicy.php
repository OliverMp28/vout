<?php

namespace App\Policies;

use App\Models\OAuthUserGrant;
use App\Models\User;

/**
 * Política de autorización para grants OAuth.
 *
 * Un grant pertenece a un usuario concreto (`user_id`) y solo ese usuario
 * puede revocarlo. Anti-IDOR: la ruta `DELETE /settings/connected-apps/{grant}`
 * usa route model binding por uuid, así que sin esta policy un atacante
 * con un uuid válido podría revocar grants ajenos.
 */
class OAuthUserGrantPolicy
{
    public function delete(User $user, OAuthUserGrant $grant): bool
    {
        return $user->id === $grant->user_id;
    }
}
