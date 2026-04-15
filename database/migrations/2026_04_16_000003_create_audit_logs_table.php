<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Bitácora inmutable de acciones administrativas (Fase 4.2).
     *
     * Diseño:
     * - `admin_id` nullable: las acciones disparadas desde CLI
     *   (`vout:make-admin`) se registran sin admin asociado.
     * - `auditable_*`: morphs polimórfico para apuntar a cualquier recurso
     *   (RegisteredApp, Game, Category, Developer, User…).
     * - `changes` json nullable: snapshot de los cambios aplicados.
     * - `remark` text nullable: razón humana introducida por el admin
     *   (motivo de rechazo, motivo de suspensión, etc.).
     * - Sin `updated_at`: el log es inmutable por diseño.
     * - Índice compuesto `[admin_id, created_at]` para acelerar el visor
     *   filtrando por admin y fecha (Sesión 5).
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('admin_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('action', 80);
            $table->morphs('auditable');
            $table->json('changes')->nullable();
            $table->text('remark')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['admin_id', 'created_at'], 'audit_logs_admin_created_idx');
            $table->index('action', 'audit_logs_action_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
