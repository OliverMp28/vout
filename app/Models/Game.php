<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Juego disponible en el portal Vout.
 *
 * Representa un minijuego web que puede ser embebido en un iframe.
 * Cada juego puede pertenecer a múltiples categorías, tener múltiples
 * desarrolladores y ser jugado por múltiples usuarios.
 */
class Game extends Model
{
    /** @use HasFactory<\Database\Factories\GameFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'repo_url',
        'cover_image',
        'embed_url',
        'release_date',
        'play_count',
        'is_active',
        'is_featured',
    ];

    /**
     * Clave de ruta para route model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'release_date' => 'date',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'play_count' => 'integer',
        ];
    }

    /**
     * Categorías a las que pertenece el juego (many-to-many).
     * Un juego puede estar etiquetado en múltiples géneros.
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class);
    }

    /**
     * Desarrolladores que crearon o contribuyeron a este juego.
     * La tabla pivote incluye el rol de cada desarrollador.
     */
    public function developers(): BelongsToMany
    {
        return $this->belongsToMany(Developer::class)
            ->withPivot('role');
    }

    /**
     * Usuarios que han interactuado con este juego.
     * La tabla pivote almacena datos de progreso y preferencias.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('is_favorite', 'is_saved', 'play_count', 'best_score', 'last_played_at')
            ->withTimestamps();
    }

    /**
     * Scope: solo juegos activos (visibles en el catálogo).
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: solo juegos destacados (mostrados en la portada).
     */
    public function scopeFeatured(Builder $query): Builder
    {
        return $query->where('is_featured', true);
    }
}
