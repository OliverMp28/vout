<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Fachada estática para escribir entradas en el audit log administrativo
 * (Fase 4.2).
 *
 * Centraliza la creación de entradas para garantizar consistencia (mismo
 * casting, mismo orden de argumentos) y facilita el testing al ofrecer
 * un único punto de entrada que mockear si fuese necesario.
 */
final class Audit
{
    /**
     * Persiste una entrada de audit log.
     *
     * @param  User|null  $admin  Admin que disparó la acción. Null si la acción viene de CLI.
     * @param  string  $action  Identificador estable tipo `app.suspended`, `game.approved`.
     * @param  Model  $auditable  Recurso afectado (cualquier modelo Eloquent).
     * @param  array<string, mixed>  $changes  Snapshot opcional de cambios aplicados.
     * @param  string|null  $remark  Razón humana opcional (motivo, comentario).
     */
    public static function record(
        ?User $admin,
        string $action,
        Model $auditable,
        array $changes = [],
        ?string $remark = null,
    ): AuditLog {
        return AuditLog::create([
            'admin_id' => $admin?->id,
            'action' => $action,
            'auditable_type' => $auditable->getMorphClass(),
            'auditable_id' => $auditable->getKey(),
            'changes' => $changes === [] ? null : $changes,
            'remark' => $remark,
        ]);
    }
}
