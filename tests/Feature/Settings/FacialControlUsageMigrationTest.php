<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * La migración que sustituye `gestures_enabled` por el perfil de uso.
 * `RefreshDatabase` ya la ha corrido con la base de datos vacía: aquí se
 * deshace, se cargan filas con el booleano antiguo y se vuelve a aplicar.
 */

function facialControlUsageMigration(): object
{
    return require database_path('migrations/2026_11_23_175546_replace_gestures_enabled_with_facial_control_usage_in_user_settings_table.php');
}

it('quien tenía el control facial activado pasa a usarlo a veces', function (): void {
    $migration = facialControlUsageMigration();
    $migration->down();

    $withGestures = User::factory()->create();
    $withoutGestures = User::factory()->create();
    DB::table('user_settings')->insert([
        ['user_id' => $withGestures->id, 'gestures_enabled' => true],
        ['user_id' => $withoutGestures->id, 'gestures_enabled' => false],
    ]);

    $migration->up();

    expect(Schema::hasColumn('user_settings', 'gestures_enabled'))->toBeFalse()
        ->and(DB::table('user_settings')->where('user_id', $withGestures->id)->value('facial_control_usage'))->toBe('occasional')
        ->and(DB::table('user_settings')->where('user_id', $withoutGestures->id)->value('facial_control_usage'))->toBe('off')
        ->and((bool) DB::table('user_settings')->where('user_id', $withGestures->id)->value('camera_autostart'))->toBeFalse();
});

it('deshacerla devuelve el booleano a quien usaba la cámara', function (): void {
    $user = User::factory()->create();
    DB::table('user_settings')->insert(['user_id' => $user->id, 'facial_control_usage' => 'primary']);

    facialControlUsageMigration()->down();

    expect(Schema::hasColumn('user_settings', 'facial_control_usage'))->toBeFalse()
        ->and((bool) DB::table('user_settings')->where('user_id', $user->id)->value('gestures_enabled'))->toBeTrue();
});
