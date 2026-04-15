<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Vincula un juego enviado desde el Developer Portal con la `RegisteredApp`
     * del propio dev (Fase 4.2). La FK es nullable porque los juegos seedeados
     * (curados internamente) no pertenecen a ninguna app del ecosistema OAuth.
     *
     * `nullOnDelete`: si el dev elimina su app desde el portal, sus juegos
     * publicados permanecen en el catálogo pero quedan desvinculados (los
     * `effective_origins` caen al fallback de `embed_url`).
     */
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->foreignId('registered_app_id')
                ->nullable()
                ->after('submitted_by_user_id')
                ->constrained('registered_apps')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('registered_app_id');
        });
    }
};
