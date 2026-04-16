<?php

namespace App\Models;

use Database\Factories\RegisteredAppFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
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
        'suspended_at',
        'suspension_reason',
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
            'suspended_at' => 'datetime',
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
     * Scope: aplicaciones suspendidas por un admin.
     */
    public function scopeSuspended(Builder $query): Builder
    {
        return $query->whereNotNull('suspended_at');
    }

    // ─── Relaciones ──────────────────────────────────────────

    /**
     * Usuario propietario de la aplicación (creador desde el Developer Portal).
     * Nullable para apps creadas vía seed antes de la Fase 4.1.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Accessors ───────────────────────────────────────────

    /**
     * Indica si la app está suspendida por un admin.
     */
    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    /**
     * Estado derivado para UI: `active`, `paused` o `suspended`.
     *
     * Prioridad: suspended > paused > active. Suspendida prevalece sobre
     * el flag `is_active` porque fue impuesta por un admin.
     */
    protected function effectiveStatus(): Attribute
    {
        return Attribute::get(function (): string {
            if ($this->isSuspended()) {
                return 'suspended';
            }

            return $this->is_active ? 'active' : 'paused';
        });
    }
}
