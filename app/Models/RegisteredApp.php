<?php

namespace App\Models;

use Database\Factories\RegisteredAppFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Aplicación externa registrada en el ecosistema Vout (SSO).
 *
 * Representa un proyecto externo (ej. "Dino") que utiliza
 * Vout como proveedor de identidad. El campo `allowed_origins`
 * define los dominios autorizados para CORS/postMessage.
 */
class RegisteredApp extends Model
{
    /** @use HasFactory<RegisteredAppFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'app_url',
        'allowed_origins',
        'is_active',
        'oauth_client_id',
        'is_first_party',
        'requires_auth',
    ];

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'allowed_origins' => 'array',
            'is_active' => 'boolean',
            'is_first_party' => 'boolean',
            'requires_auth' => 'boolean',
        ];
    }

    /**
     * Clave de ruta para route model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Scope: solo aplicaciones activas (habilitadas para SSO).
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: aplicaciones cuyo propietario es el usuario indicado.
     * Útil en el Developer Portal para filtrar el listado del dashboard.
     */
    public function scopeOwnedBy(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id);
    }

    /**
     * Usuario propietario de la aplicación (creador desde el Developer Portal).
     * Nullable para apps creadas vía seed antes de la Fase 4.1.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
