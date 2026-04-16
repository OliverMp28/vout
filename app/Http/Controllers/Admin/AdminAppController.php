<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SuspendAppRequest;
use App\Models\RegisteredApp;
use App\Notifications\AppSuspendedNotification;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Passport\Passport;

/**
 * Panel de Administración — gestión de apps del ecosistema (Fase 4.2, S2).
 *
 * Permite al admin listar, inspeccionar, marcar como first-party, suspender
 * (con revocación de tokens OAuth), reactivar y eliminar cualquier app
 * registrada. Cada acción crítica se registra en el audit log.
 */
class AdminAppController extends Controller
{
    /**
     * Listado paginado de todas las apps con filtros opcionales.
     */
    public function index(Request $request): Response
    {
        $query = RegisteredApp::query()->with('user:id,name,email');

        // Filtro por estado derivado
        if ($request->filled('status')) {
            match ($request->input('status')) {
                'active' => $query->where('is_active', true)->whereNull('suspended_at'),
                'paused' => $query->where('is_active', false)->whereNull('suspended_at'),
                'suspended' => $query->whereNotNull('suspended_at'),
                default => null,
            };
        }

        // Filtro por first-party
        if ($request->filled('first_party')) {
            $query->where('is_first_party', $request->boolean('first_party'));
        }

        // Búsqueda por nombre o email del owner
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($u) use ($search): void {
                        $u->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $apps = $query->orderByDesc('created_at')->paginate(20)->withQueryString();

        return Inertia::render('admin/apps/index', [
            'apps' => $apps,
            'filters' => $request->only(['status', 'first_party', 'search']),
        ]);
    }

    /**
     * Detalle de una app con info del owner y del client OAuth.
     */
    public function show(RegisteredApp $app): Response
    {
        $app->load('user:id,name,email,username');

        $client = null;
        if ($app->oauth_client_id) {
            $client = Passport::client()->newQuery()->find($app->oauth_client_id);
        }

        return Inertia::render('admin/apps/show', [
            'app' => [
                ...$app->only([
                    'id', 'name', 'slug', 'app_url', 'allowed_origins',
                    'is_active', 'is_first_party', 'requires_auth',
                    'oauth_client_id', 'suspended_at', 'suspension_reason',
                    'created_at', 'updated_at',
                ]),
                'effective_status' => $app->effective_status,
                'owner' => $app->user ? $app->user->only(['id', 'name', 'email', 'username']) : null,
            ],
            'client' => $client ? [
                'id' => $client->id,
                'revoked' => (bool) $client->revoked,
                'confidential' => $client->confidential(),
            ] : null,
        ]);
    }

    /**
     * Alterna el badge first-party (solo distinción visual, sin efecto funcional
     * excepto en `skipsAuthorization` del Client model de Passport).
     */
    public function toggleFirstParty(Request $request, RegisteredApp $app): RedirectResponse
    {
        $app->update(['is_first_party' => ! $app->is_first_party]);

        Audit::record(
            $request->user(),
            $app->is_first_party ? 'app.marked_first_party' : 'app.unmarked_first_party',
            $app,
        );

        return back()->with('status', 'admin.apps.first_party_toggled');
    }

    /**
     * Suspende una app: desactiva, revoca el client OAuth (invalidando todos
     * los tokens vivos), y notifica al owner por mail+DB.
     *
     * La reactivación posterior NO restaura el client OAuth — el dev debe
     * regenerar credenciales. Esto fuerza una rotación natural de secretos.
     */
    public function suspend(SuspendAppRequest $request, RegisteredApp $app): RedirectResponse
    {
        abort_if($app->isSuspended(), 422, __('admin.apps.already_suspended'));

        $reason = $request->validated('remark');

        DB::transaction(function () use ($app, $reason, $request): void {
            // Revocar client OAuth si existe (revoke tokens + mark client revoked)
            if ($app->oauth_client_id) {
                $client = Passport::client()->newQuery()->find($app->oauth_client_id);
                if ($client) {
                    $client->tokens()->with('refreshToken')->get()->each(function ($token): void {
                        $token->refreshToken?->revoke();
                        $token->revoke();
                    });
                    $client->forceFill(['revoked' => true])->save();
                }
            }

            $app->update([
                'is_active' => false,
                'suspended_at' => now(),
                'suspension_reason' => $reason,
                'oauth_client_id' => null,
            ]);

            Audit::record($request->user(), 'app.suspended', $app, [
                'reason' => $reason,
            ]);
        });

        // Notificar al owner fuera de la transacción
        $app->user?->notify(new AppSuspendedNotification($app, $reason));

        return back()->with('status', 'admin.apps.suspended');
    }

    /**
     * Reactivar una app suspendida. Quita la marca de suspensión y re-habilita
     * `is_active`. El dev deberá regenerar credenciales OAuth desde su dashboard.
     */
    public function reactivate(Request $request, RegisteredApp $app): RedirectResponse
    {
        abort_unless($app->isSuspended(), 422, __('admin.apps.not_suspended'));

        $app->update([
            'is_active' => true,
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        Audit::record($request->user(), 'app.reactivated', $app);

        return back()->with('status', 'admin.apps.reactivated');
    }

    /**
     * Eliminación permanente (destructiva). Revoca el client OAuth si existe.
     */
    public function destroy(Request $request, RegisteredApp $app): RedirectResponse
    {
        DB::transaction(function () use ($app, $request): void {
            // Borrado físico del client OAuth y sus tokens
            if ($app->oauth_client_id) {
                $client = Passport::client()->newQuery()->find($app->oauth_client_id);
                if ($client) {
                    $client->tokens()->delete();
                    $client->delete();
                }
            }

            Audit::record($request->user(), 'app.destroyed', $app, [
                'name' => $app->name,
                'owner_email' => $app->user?->email,
            ]);

            $app->delete();
        });

        return to_route('admin.apps.index')
            ->with('status', 'admin.apps.destroyed');
    }
}
