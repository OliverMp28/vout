<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Añade el flag `is_admin` para soportar el Panel de Administración interno
     * (Fase 4.2). Modelo de roles minimalista: un solo boolean en `users` evita
     * tablas pivote y dependencias externas.
     *
     * El índice parcial sobre `is_admin = true` mantiene rendimiento en consultas
     * "listar admins" sin penalizar el resto del catálogo de usuarios.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_admin')
                ->default(false)
                ->after('google_id');

            $table->index('is_admin', 'users_is_admin_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_is_admin_idx');
            $table->dropColumn('is_admin');
        });
    }
};
