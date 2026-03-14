<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Categoría de juegos dentro del portal Vout.
 *
 * Agrupa los juegos por género (Acción, Puzzle, etc.).
 * Un juego puede pertenecer a múltiples categorías y
 * una categoría puede contener múltiples juegos (many-to-many).
 */
class Category extends Model
{
    /** @use HasFactory<\Database\Factories\CategoryFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
    ];

    /**
     * Clave de ruta para route model binding.
     * Permite usar /categories/{slug} en lugar de /categories/{id}.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Juegos que pertenecen a esta categoría (many-to-many).
     */
    public function games(): BelongsToMany
    {
        return $this->belongsToMany(Game::class);
    }
}
