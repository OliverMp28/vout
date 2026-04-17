<?php

namespace App\Http\Controllers\Admin;

use App\Enums\GameStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Panel de Administración — Dashboard de aterrizaje (Fase 4.2, S5).
 *
 * Agrega counts ligeros para las métricas principales y el feed
 * reciente del audit log. Todo se sirve desde una sola query por
 * recurso (sin N+1) para mantener el render por debajo de 50 ms.
 */
class AdminDashboardController extends Controller
{
    /**
     * Render del dashboard con métricas y las últimas 10 entradas del
     * audit log — la página de aterrizaje del panel.
     */
    public function __invoke(): Response
    {
        return Inertia::render('admin/dashboard', [
            'metrics' => $this->buildMetrics(),
            'recentActivity' => $this->buildRecentActivity(),
        ]);
    }

    /**
     * @return array<string, array{value:int, trend:?string}>
     */
    private function buildMetrics(): array
    {
        return [
            'gamesPending' => [
                'value' => Game::query()->pendingReview()->count(),
                'trend' => null,
            ],
            'gamesPublished' => [
                'value' => Game::query()
                    ->where('status', GameStatus::Published->value)
                    ->count(),
                'trend' => null,
            ],
            'appsActive' => [
                'value' => RegisteredApp::query()
                    ->where('is_active', true)
                    ->whereNull('suspended_at')
                    ->count(),
                'trend' => null,
            ],
            'appsSuspended' => [
                'value' => RegisteredApp::query()
                    ->whereNotNull('suspended_at')
                    ->count(),
                'trend' => null,
            ],
            'developersClaimed' => [
                'value' => Developer::query()
                    ->whereNotNull('user_id')
                    ->count(),
                'trend' => null,
            ],
            'developersManual' => [
                'value' => Developer::query()
                    ->whereNull('user_id')
                    ->count(),
                'trend' => null,
            ],
            'categories' => [
                'value' => Category::query()->count(),
                'trend' => null,
            ],
            'admins' => [
                'value' => User::query()->where('is_admin', true)->count(),
                'trend' => null,
            ],
        ];
    }

    /**
     * Últimas 10 entradas del audit log en forma ligera para el feed
     * lateral del dashboard. Eager load del admin para evitar N+1.
     *
     * @return list<array<string, mixed>>
     */
    private function buildRecentActivity(): array
    {
        return AuditLog::query()
            ->with('admin:id,name,email')
            ->recent()
            ->limit(10)
            ->get()
            ->map(fn (AuditLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'auditable_type' => $log->auditable_type,
                'auditable_id' => $log->auditable_id,
                'created_at' => $log->created_at?->toIso8601String(),
                'admin' => $log->admin ? [
                    'id' => $log->admin->id,
                    'name' => $log->admin->name,
                    'email' => $log->admin->email,
                ] : null,
            ])
            ->all();
    }
}
