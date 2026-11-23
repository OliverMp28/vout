<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Qué respondió el usuario cuando el juego le sugirió sus controles
     * (`suggestedPreset` en el READY), para no preguntarle en cada partida:
     *
     * - null  → aún no se le ha preguntado.
     * - 'own' → se queda con sus controles.
     * - otro  → la clave del preset que aceptó.
     */
    public function up(): void
    {
        Schema::table('game_user', function (Blueprint $table): void {
            $table->string('gesture_preset_choice', 32)->nullable()->after('last_played_at');
        });
    }

    public function down(): void
    {
        Schema::table('game_user', function (Blueprint $table): void {
            $table->dropColumn('gesture_preset_choice');
        });
    }
};
