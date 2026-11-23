<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Preferencias de la página de juego, guardadas con la cuenta (con sesión
     * iniciada las preferencias viven en la cuenta, no en el navegador):
     *
     * - `play_panel_open`: si el panel de control facial está abierto. Null
     *   es "lo que diga el perfil de uso" (abierto solo para quien juega con
     *   la cámara).
     * - `show_camera_preview`: ver la cámara mientras se juega.
     */
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table): void {
            $table->boolean('play_panel_open')->nullable()->after('camera_autostart');
            $table->boolean('show_camera_preview')->default(false)->after('play_panel_open');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table): void {
            $table->dropColumn(['play_panel_open', 'show_camera_preview']);
        });
    }
};
