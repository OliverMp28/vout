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
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();

            $table->string('username', 50)->unique()->after('name');
            $table->string('avatar', 500)->nullable()->after('email');
            $table->text('bio')->nullable()->after('avatar');
            $table->string('google_id')->nullable()->unique()->after('two_factor_confirmed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable(false)->change();

            $table->dropColumn(['username', 'avatar', 'bio', 'google_id']);
        });
    }
};
