<?php

namespace App\Models;

use Database\Factories\DeveloperFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Desarrollador o estudio que crea juegos para el portal.
 *
 * Un desarrollador puede participar en múltiples juegos
 * con diferentes roles (ej. "Programador Principal", "Diseñador").
 *
 * Desde Fase 4.2 S4.5, una ficha puede estar reclamada (`user_id != null`)
 * por un usuario del Developer Portal que la mantiene él mismo. Las fichas
 * sin `user_id` son entradas manuales curadas por el admin (p.ej. estudios
 * históricos sin cuenta Vout).
 */
class Developer extends Model
{
    /** @use HasFactory<DeveloperFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'user_id',
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

    /**
     * Usuario del portal que mantiene esta ficha (puede ser null si la creó
     * el admin como entrada manual).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope: fichas reclamadas por un usuario del portal.
     */
    public function scopeClaimed(Builder $query): Builder
    {
        return $query->whereNotNull('user_id');
    }

    /**
     * Scope: fichas manuales (sin usuario vinculado).
     */
    public function scopeManual(Builder $query): Builder
    {
        return $query->whereNull('user_id');
    }
}
