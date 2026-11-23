<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reemplaza el booleano `gestures_enabled` por el perfil de uso
     * `facial_control_usage` (`App\Enums\FacialControlUsage`): no uso la
     * cámara / la uso a veces / juego con la cámara. Añade además
     * `camera_autostart`, la autorización (aparte, solo con "juego con la
     * cámara") para que la cámara se encienda sola al abrir un juego
     * compatible.
     *
     * Migra los datos: quien tenía el control facial activado pasa a "la uso
     * a veces", que es exactamente lo que tenía (el motor se prepara en el
     * juego si tiene perfil, y lo activa con un clic).
     */
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table): void {
            $table->string('facial_control_usage', 12)->default('off')->after('show_mascot');
            $table->boolean('camera_autostart')->default(false)->after('facial_control_usage');
        });

        DB::table('user_settings')->where('gestures_enabled', true)->update(['facial_control_usage' => 'occasional']);

        Schema::table('user_settings', function (Blueprint $table): void {
            $table->dropColumn('gestures_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table): void {
            $table->boolean('gestures_enabled')->default(false)->after('show_mascot');
        });

        DB::table('user_settings')->where('facial_control_usage', '!=', 'off')->update(['gestures_enabled' => true]);

        Schema::table('user_settings', function (Blueprint $table): void {
            $table->dropColumn(['facial_control_usage', 'camera_autostart']);
        });
    }
};
