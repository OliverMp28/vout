<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Puebla la tabla de categorías con los géneros base del portal.
 *
 * Estas categorías son las iniciales para organizar el catálogo
 * de juegos. Se pueden agregar más desde el panel de administración
 * cuando exista.
 */
class CategorySeeder extends Seeder
{
    /**
     * Categorías base del portal de juegos.
     *
     * @var list<string>
     */
    private const CATEGORIES = [
        'Acción',
        'Puzzle',
        'Aventura',
        'Deportes',
        'Estrategia',
        'Arcade',
    ];

    /**
     * Ejecuta el seeder de categorías.
     */
    public function run(): void
    {
        foreach (self::CATEGORIES as $name) {
            Category::query()->firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name],
            );
        }
    }
}
