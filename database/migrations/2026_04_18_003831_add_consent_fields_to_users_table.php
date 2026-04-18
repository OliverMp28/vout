<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fase 5 — Consentimiento explícito en registro.
     *
     * Persistimos el timestamp y la versión de Términos/Privacidad que el
     * usuario aceptó al crear su cuenta. Guardarlo en `users` en vez de
     * en `audit_logs` nos da dos cosas gratis:
     *   1) Podemos re-pedir consentimiento cuando cambie la versión (WHERE
     *      privacy_version_accepted != 'current').
     *   2) Auditoría ligera sin tocar el pivot del panel admin, que está
     *      reservado para acciones administrativas.
     * Ambos campos son nullable para no romper los seed/factories antiguos.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('terms_accepted_at')->nullable()->after('is_admin');
            $table->string('privacy_version_accepted', 20)->nullable()->after('terms_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['terms_accepted_at', 'privacy_version_accepted']);
        });
    }
};
