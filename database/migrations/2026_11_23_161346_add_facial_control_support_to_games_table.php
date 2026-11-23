<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Si el juego admite el control facial (`App\Enums\FacialControlSupport`).
     *
     * Lo declara el desarrollador y lo revisa el admin: el portal no puede
     * comprobar si un juego de otro origen entiende las teclas que le manda.
     * Por defecto ninguno lo admite.
     */
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->string('facial_control_support', 12)->default('none')->after('embed_url');
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->dropColumn('facial_control_support');
        });
    }
};
