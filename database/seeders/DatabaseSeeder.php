<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Database\Seeder;

/**
 * Seeder principal que orquesta la población de la base de datos.
 *
 * Ejecuta los seeders de dominio en el orden correcto
 * respetando las restricciones de clave foránea.
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Puebla la base de datos de la aplicación.
     */
    public function run(): void
    {
        $this->call([
            CategorySeeder::class,
            CatalogSeeder::class,
        ]);

        $user = User::factory()->create([
            'name' => 'Test User',
            'username' => 'testuser',
            'email' => 'test@example.com',
        ]);

        UserSetting::factory()->create([
            'user_id' => $user->id,
        ]);
    }
}
