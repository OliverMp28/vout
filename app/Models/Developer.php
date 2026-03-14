<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Desarrollador o estudio que crea juegos para el portal.
 *
 * Un desarrollador puede participar en múltiples juegos
 * con diferentes roles (ej. "Programador Principal", "Diseñador").
 */
class Developer extends Model
{
    /** @use HasFactory<\Database\Factories\DeveloperFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'website_url',
        'bio',
        'logo_url',
    ];

    /**
     * Clave de ruta para route model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Juegos en los que participa este desarrollador.
     * La tabla pivote incluye el rol del desarrollador en cada juego.
     */
    public function games(): BelongsToMany
    {
        return $this->belongsToMany(Game::class)
            ->withPivot('role');
    }
}
