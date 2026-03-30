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
        Schema::table('registered_apps', function (Blueprint $table) {
            $table->uuid('oauth_client_id')->nullable()->after('id');
            $table->boolean('is_first_party')->default(false)->after('oauth_client_id');
            $table->boolean('requires_auth')->default(true)->after('is_first_party');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('registered_apps', function (Blueprint $table) {
            $table->dropColumn(['oauth_client_id', 'is_first_party', 'requires_auth']);
        });
    }
};
