<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Si hace falta una cuenta de Vout para jugar (`App\Enums\AccountRequirement`).
     *
     * Lo declara el desarrollador y lo revisa el admin. Por defecto hace
     * falta, como hasta ahora: un juego que espera la identidad del jugador
     * no se rompe por recibir invitados.
     */
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->string('account_requirement', 10)->default('required')->after('facial_control_support');
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->dropColumn('account_requirement');
        });
    }
};
