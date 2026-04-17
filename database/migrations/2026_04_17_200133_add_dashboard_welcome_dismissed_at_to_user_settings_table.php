<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marca la última vez que el usuario cerró el hero de onboarding del
     * dashboard (Fase 2.5). Nullable: ausencia significa que nunca lo ha
     * descartado y el hero se muestra mientras no tenga partidas jugadas.
     */
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->timestamp('dashboard_welcome_dismissed_at')->nullable()->after('gestures_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn('dashboard_welcome_dismissed_at');
        });
    }
};
