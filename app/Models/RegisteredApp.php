<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Aplicación externa registrada en el ecosistema Vout (SSO).
 *
 * Representa un proyecto externo (ej. "Dino") que utiliza
 * Vout como proveedor de identidad. El campo `allowed_origins`
 * define los dominios autorizados para CORS/postMessage.
 */
class RegisteredApp extends Model
{
    /** @use HasFactory<\Database\Factories\RegisteredAppFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
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
}
