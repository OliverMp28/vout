<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data migration — revoca los tokens de sesión de juego heredados.
 *
 * Hasta ahora `PlayController` emitía un Personal Access Token
 * (`game-session:{slug}`) por cada visita a `/play/{game}`, con la TTL de
 * los PAT (6 meses) y sin revocarlo nunca. Desde esta versión los emite
 * `GameSessionTokenIssuer` con la TTL de los access tokens (60 min).
 *
 * Aquí se invalidan los antiguos: cualquier `game-session:*` vivo cuya
 * expiración quede más allá de la TTL actual solo puede ser uno de los
 * de 6 meses. Los JWT ya entregados siguen verificando firma en clientes
 * stateless hasta su `exp`, pero dejan de valer contra la API de Vout.
 */
return new class extends Migration
{
    public function up(): void
    {
        $longestLegitimateExpiry = now()->addMinutes(
            (int) config('vout.passport.access_token_ttl_minutes', 60),
        );

        DB::table('oauth_access_tokens')
            ->where('name', 'like', 'game-session:%')
            ->where('revoked', false)
            ->where('expires_at', '>', $longestLegitimateExpiry)
            ->update(['revoked' => true]);
    }

    public function down(): void
    {
        // No-op: revocar es intencionalmente irreversible. Reactivar tokens
        // de 6 meses reabriría justo la exposición que esta migración cierra.
    }
};
