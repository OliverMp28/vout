<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Data migration retroactiva — Fase oauth_user_grants.
 *
 * Crea un `oauth_user_grants` por cada par (user_id, client_id) con
 * `oauth_access_tokens` no revocados y no expirados, agrupando los
 * scopes (union) y filtrando casos que no deben generar grant:
 *
 *   - Tokens sin `user_id` (client_credentials).
 *   - Clients sin `RegisteredApp` asociada (PATs / clients técnicos).
 *   - Apps marcadas `is_first_party=true`.
 *
 * Es idempotente: usa `INSERT IGNORE` (vía `insertOrIgnore`) sobre el
 * unique `(user_id, client_id)`. Si el seed se ejecuta dos veces, la
 * segunda ronda no duplica filas. Pensada como migración aparte de la
 * que crea el schema, así un fallo aquí no obliga a revertir la tabla.
 */
return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('oauth_access_tokens as t')
            ->join('registered_apps as a', 'a.oauth_client_id', '=', 't.client_id')
            ->where('t.revoked', false)
            ->whereNotNull('t.user_id')
            ->where('t.expires_at', '>', now())
            ->where('a.is_first_party', false)
            ->select('t.user_id', 't.client_id', 't.scopes')
            ->get();

        if ($rows->isEmpty()) {
            return;
        }

        $now = now();

        $grouped = $rows->groupBy(static fn ($row): string => $row->user_id.'|'.$row->client_id);

        $inserts = [];

        foreach ($grouped as $tokens) {
            $first = $tokens->first();
            $allScopes = $tokens
                ->flatMap(static function ($row): array {
                    $decoded = json_decode((string) $row->scopes, true);

                    return is_array($decoded) ? $decoded : [];
                })
                ->unique()
                ->values()
                ->all();

            $inserts[] = [
                'id' => (string) Str::uuid(),
                'user_id' => $first->user_id,
                'client_id' => $first->client_id,
                'scopes' => json_encode($allScopes),
                'granted_at' => $now,
                'updated_scopes_at' => null,
                'revoked_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('oauth_user_grants')->insertOrIgnore($inserts);
    }

    public function down(): void
    {
        // No-op: la creación retroactiva es informativa. Si se revierte
        // la migración del schema (000001), la tabla entera desaparece y
        // no hay nada que limpiar aquí.
    }
};
