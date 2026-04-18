<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reemplaza el booleano `dark_mode` por la cadena `appearance` con
     * tres valores ('light', 'dark', 'system') para que la preferencia
     * de tema sea la única fuente de verdad para usuarios logueados
     * (antes existía un boolean en BD desconectado del tema real, que
     * se controlaba sólo por cookie/localStorage).
     *
     * Migra los datos existentes: dark_mode=true → 'dark', false → 'system'
     * (no asumimos 'light' porque históricamente "false" significaba
     * "no forzar oscuro", lo más cercano al comportamiento previo
     * cuando system es claro por defecto).
     */
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table): void {
            $table->string('appearance', 10)->default('system')->after('user_id');
        });

        DB::table('user_settings')->where('dark_mode', true)->update(['appearance' => 'dark']);
        DB::table('user_settings')->where('dark_mode', false)->update(['appearance' => 'system']);

        Schema::table('user_settings', function (Blueprint $table): void {
            $table->dropColumn('dark_mode');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table): void {
            $table->boolean('dark_mode')->default(false)->after('user_id');
        });

        DB::table('user_settings')->where('appearance', 'dark')->update(['dark_mode' => true]);

        Schema::table('user_settings', function (Blueprint $table): void {
            $table->dropColumn('appearance');
        });
    }
};
