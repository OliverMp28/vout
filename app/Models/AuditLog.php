<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Entrada inmutable del audit log administrativo (Fase 4.2).
 *
 * Cada operación crítica realizada desde el panel admin (aprobar juego,
 * suspender app, eliminar categoría, promover usuario…) deja una entrada
 * aquí para garantizar trazabilidad. La escritura se canaliza a través de
 * `App\Support\Audit::record()` para evitar entradas mal formadas.
 */
class AuditLog extends Model
{
    /**
     * El log es inmutable: solo `created_at`.
     */
    public const UPDATED_AT = null;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'admin_id',
        'action',
        'auditable_type',
        'auditable_id',
        'changes',
        'remark',
    ];

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Administrador que disparó la acción.
     * Nullable para acciones originadas en CLI (`vout:make-admin`).
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    /**
     * Recurso afectado por la acción (RegisteredApp, Game, Category…).
     */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Scope: filtra por nombre de acción exacta (ej. 'app.suspended').
     */
    public function scopeAction(Builder $query, string $action): Builder
    {
        return $query->where('action', $action);
    }

    /**
     * Scope: ordena por fecha descendente para timelines.
     */
    public function scopeRecent(Builder $query): Builder
    {
        return $query->orderByDesc('created_at');
    }
}
