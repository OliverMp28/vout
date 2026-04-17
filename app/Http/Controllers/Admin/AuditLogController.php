<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Panel de Administración — Visor del audit log (Fase 4.2, S5).
 *
 * Timeline paginada de cada acción crítica registrada desde el panel
 * admin (aprobaciones, suspensiones, eliminaciones, reasignaciones…).
 * Diseñado para auditoría y postmortems; no permite escritura ni
 * edición — el audit log es inmutable por contrato (`Audit::record`).
 */
class AuditLogController extends Controller
{
    /**
     * Tamaño por página del timeline. Equilibra densidad informativa y
     * coste por render; con cursor pagination el escalado a millones de
     * filas sigue siendo O(1) por página.
     */
    private const PAGE_SIZE = 25;

    /**
     * Render del visor con filtros, timeline paginada y los selectores
     * poblados en servidor para evitar una segunda request del cliente.
     */
    public function index(Request $request): Response
    {
        $query = AuditLog::query()
            ->with([
                'admin:id,name,email',
                'auditable',
            ])
            ->recent();

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('admin_id')) {
            $query->where('admin_id', $request->input('admin_id'));
        }

        if ($request->filled('auditable_type')) {
            $query->where(
                'auditable_type',
                $this->resolveAuditableType($request->input('auditable_type')),
            );
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        $logs = $query->cursorPaginate(self::PAGE_SIZE)->withQueryString();

        return Inertia::render('admin/audit/index', [
            'logs' => [
                'data' => collect($logs->items())
                    ->map(fn (AuditLog $log): array => $this->serializeLog($log))
                    ->values()
                    ->all(),
                'next_cursor' => $logs->nextCursor()?->encode(),
                'prev_cursor' => $logs->previousCursor()?->encode(),
            ],
            'filters' => [
                'action' => $request->input('action'),
                'admin_id' => $request->input('admin_id')
                    ? (int) $request->input('admin_id')
                    : null,
                'auditable_type' => $request->input('auditable_type'),
                'from' => $request->input('from'),
                'to' => $request->input('to'),
            ],
            'availableActions' => $this->availableActions(),
            'availableAdmins' => $this->availableAdmins(),
            'availableTypes' => $this->availableTypes(),
        ]);
    }

    /**
     * Transforma una entrada en un payload plano para el frontend,
     * resolviendo el nombre humano del recurso afectado cuando existe.
     *
     * @return array<string, mixed>
     */
    private function serializeLog(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'changes' => $log->changes,
            'remark' => $log->remark,
            'created_at' => $log->created_at?->toIso8601String(),
            'admin' => $log->admin ? [
                'id' => $log->admin->id,
                'name' => $log->admin->name,
                'email' => $log->admin->email,
            ] : null,
            'auditable' => [
                'type' => $this->shortMorphType($log->auditable_type),
                'id' => $log->auditable_id,
                'label' => $this->resolveAuditableLabel($log),
            ],
        ];
    }

    /**
     * Etiqueta humana para el recurso afectado (nombre, slug, email…).
     * Cae al ID si el recurso ya fue eliminado — un audit de borrado,
     * por diseño, apunta a un morph huérfano.
     */
    private function resolveAuditableLabel(AuditLog $log): ?string
    {
        $auditable = $log->auditable;

        if (! $auditable) {
            return null;
        }

        return match (true) {
            isset($auditable->name) => $auditable->name,
            isset($auditable->email) => $auditable->email,
            default => '#'.$auditable->getKey(),
        };
    }

    /**
     * Convierte `App\Models\Game` → `Game` para el selector UI.
     */
    private function shortMorphType(?string $fqcn): ?string
    {
        if (! $fqcn) {
            return null;
        }

        $parts = explode('\\', $fqcn);

        return end($parts) ?: $fqcn;
    }

    /**
     * Mapea el nombre corto recibido del frontend al FQCN persistido.
     */
    private function resolveAuditableType(string $shortName): string
    {
        $map = [
            'Game' => Game::class,
            'RegisteredApp' => RegisteredApp::class,
            'Category' => Category::class,
            'Developer' => Developer::class,
            'User' => User::class,
        ];

        return $map[$shortName] ?? $shortName;
    }

    /**
     * Lista distinta de acciones registradas en la tabla — se usa para
     * poblar el `<Select>` del filtro sin opciones fantasma.
     *
     * @return list<string>
     */
    private function availableActions(): array
    {
        return AuditLog::query()
            ->select('action')
            ->distinct()
            ->orderBy('action')
            ->pluck('action')
            ->all();
    }

    /**
     * Admins que han dejado rastro — sólo los que aparecen en el log
     * (evita listar admins sin actividad en el selector).
     *
     * @return list<array{id:int,name:string,email:string}>
     */
    private function availableAdmins(): array
    {
        return User::query()
            ->whereIn(
                'id',
                AuditLog::query()
                    ->whereNotNull('admin_id')
                    ->select('admin_id')
                    ->distinct(),
            )
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $u): array => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
            ])
            ->all();
    }

    /**
     * Tipos morfables que existen hoy en el log.
     *
     * @return list<string>
     */
    private function availableTypes(): array
    {
        return AuditLog::query()
            ->select('auditable_type')
            ->distinct()
            ->pluck('auditable_type')
            ->map(fn (?string $fqcn): ?string => $this->shortMorphType($fqcn))
            ->filter()
            ->values()
            ->all();
    }
}
