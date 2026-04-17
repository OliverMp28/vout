<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 4.2, S4.5 — Developer Profile self-registration.
 *
 * Una ficha de `developers` pasa a ser reclamable por un usuario del portal:
 * añadimos `user_id` (único, nullable). Las entradas seed/manuales del admin
 * conservan `user_id = null` (fichas tipo estudio histórico sin cuenta Vout).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('developers', function (Blueprint $table): void {
            $table->foreignId('user_id')
                ->nullable()
                ->unique()
                ->after('slug')
                ->constrained()
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('developers', function (Blueprint $table): void {
            $table->dropForeign(['user_id']);
            $table->dropUnique(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};
