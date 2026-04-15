<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Añade trazabilidad de envío al catálogo y un estado de moderación
     * para soportar el flujo Game-only del Developer Portal (Fase 4.1).
     *
     * - submitted_by_user_id: usuario que envió el juego al catálogo.
     *   nullOnDelete: si el dev se da de baja, el juego no se borra
     *   (preserva enlaces públicos del catálogo).
     *
     * - status: estado de moderación (draft | pending_review | published | rejected).
     *   Default 'published' para no alterar los juegos ya existentes en el catálogo.
     *
     * - Índice compuesto [status, is_active]: optimiza el filtrado público
     *   del catálogo (status='published' AND is_active=1).
     */
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->foreignId('submitted_by_user_id')
                ->nullable()
                ->after('id')
                ->constrained('users')
                ->nullOnDelete();

            $table->string('status', 20)
                ->default('published')
                ->after('is_active');

            $table->index(['status', 'is_active'], 'games_status_active_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table): void {
            $table->dropIndex('games_status_active_idx');
            $table->dropColumn('status');
            $table->dropConstrainedForeignId('submitted_by_user_id');
        });
    }
};
