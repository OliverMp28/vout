<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla `oauth_user_grants` — persistencia del consentimiento OAuth.
 *
 * Desacopla el "el usuario autorizó esta app con estos scopes" de la vida
 * de los `oauth_access_tokens`: los tokens caducan a los 60 min, pero el
 * grant sobrevive hasta que el usuario lo revoque desde
 * /settings/connected-apps. Habilita la paridad UX con Google/GitHub
 * (autoriza una vez, recuerda) sin renunciar al `prompt=consent` de OIDC,
 * que sigue siendo respetado por Passport upstream.
 *
 * Diseño:
 *   - `id` UUID consistente con `oauth_clients` y `oauth_access_tokens`.
 *   - `unique(user_id, client_id)` — un grant lógico por par. Las
 *     reactivaciones tras revoke usan UPDATE, no INSERT nuevo.
 *   - `cascadeOnDelete` en `client_id` para que borrar un Passport client
 *     limpie sus grants huérfanos automáticamente.
 *   - `index(user_id, revoked_at)` para que el listado en Settings sea
 *     barato sin tocar los scopes de cada fila.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oauth_user_grants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('client_id')->constrained('oauth_clients', 'id')->cascadeOnDelete();
            $table->json('scopes');
            $table->timestamp('granted_at');
            $table->timestamp('updated_scopes_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'client_id']);
            $table->index(['user_id', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oauth_user_grants');
    }
};
