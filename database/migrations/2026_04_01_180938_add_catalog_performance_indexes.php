<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Añade índices de rendimiento para el catálogo de juegos.
     *
     * Optimiza las queries más frecuentes: filtrado por estado,
     * ordenación por popularidad/fecha y búsqueda fulltext.
     */
    public function up(): void
    {
        $isMysql = in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb']);

        Schema::table('games', function (Blueprint $table) use ($isMysql) {
            $table->index('is_active', 'games_is_active_idx');
            $table->index('is_featured', 'games_is_featured_idx');
            $table->index(['is_active', 'play_count'], 'games_active_popular_idx');
            $table->index(['is_active', 'release_date'], 'games_active_newest_idx');
            $table->index(['is_active', 'name'], 'games_active_name_idx');

            // El índice fulltext solo es soportado por MySQL/MariaDB.
            // En SQLite (entorno de tests) se omite sin afectar la funcionalidad;
            // el scopeSearch hace fallback a LIKE automáticamente.
            if ($isMysql) {
                $table->fullText(['name', 'description'], 'games_fulltext_idx');
            }
        });

        Schema::table('game_user', function (Blueprint $table) {
            $table->index(['user_id', 'is_favorite'], 'game_user_favorites_idx');
            $table->index(['user_id', 'is_saved'], 'game_user_saved_idx');
            $table->index(['user_id', 'last_played_at'], 'game_user_last_played_idx');
        });
    }

    /**
     * Revierte los índices añadidos.
     */
    public function down(): void
    {
        $isMysql = in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb']);

        Schema::table('games', function (Blueprint $table) use ($isMysql) {
            $table->dropIndex('games_is_active_idx');
            $table->dropIndex('games_is_featured_idx');
            $table->dropIndex('games_active_popular_idx');
            $table->dropIndex('games_active_newest_idx');
            $table->dropIndex('games_active_name_idx');

            if ($isMysql) {
                $table->dropIndex('games_fulltext_idx');
            }
        });

        Schema::table('game_user', function (Blueprint $table) {
            $table->dropIndex('game_user_favorites_idx');
            $table->dropIndex('game_user_saved_idx');
            $table->dropIndex('game_user_last_played_idx');
        });
    }
};
