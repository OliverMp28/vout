<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('gesture_configs', function (Blueprint $table) {
            // 'cursor'|'gesture'|'disabled' — cómo se usa el movimiento de cabeza
            $table->string('head_tracking_mode', 20)->default('cursor')->after('gesture_mapping');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gesture_configs', function (Blueprint $table) {
            $table->dropColumn('head_tracking_mode');
        });
    }
};
