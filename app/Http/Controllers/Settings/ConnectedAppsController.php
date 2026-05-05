<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\OAuthUserGrant;
use App\Notifications\OAuthGrantRevokedNotification;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pantalla "Apps conectadas" en /settings/connected-apps — Fase oauth_user_grants.
 *
 * Lista los grants OAuth third-party activos del usuario autenticado y
 * permite revocarlos. Las apps first-party se ocultan deliberadamente
 * (paridad UX con Google "Apps con acceso"): el usuario no puede revocar
 * apps internas del propio Vout, así que no tiene sentido listarlas aquí.
 *
 * Se filtran también los grants huérfanos (cuya `RegisteredApp` fue
 * borrada por el developer) para no enseñar entradas sin metadata.
 */
class ConnectedAppsController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): Response
    {
        $user = $request->user();

        $scopeCatalog = (array) config('vout.scopes', []);

        $grants = OAuthUserGrant::query()
            ->active()
            ->where('user_id', $user->id)
            ->whereHas('registeredApp', static function ($query): void {
                $query->where('is_first_party', false);
            })
            ->with(['registeredApp:id,oauth_client_id,name,slug,app_url'])
            ->orderByDesc('granted_at')
            ->get()
            ->map(static function (OAuthUserGrant $grant) use ($scopeCatalog): array {
                $scopeIds = is_array($grant->scopes) ? $grant->scopes : [];

                return [
                    'id' => $grant->id,
                    'app' => [
                        'name' => $grant->registeredApp?->name,
                        'app_url' => $grant->registeredApp?->app_url,
                    ],
                    'scopes' => array_map(
                        static fn (string $id): array => [
                            'id' => $id,
                            'description' => (string) ($scopeCatalog[$id] ?? $id),
                        ],
                        $scopeIds,
                    ),
                    'granted_at' => $grant->granted_at?->toIso8601String(),
                    'updated_scopes_at' => $grant->updated_scopes_at?->toIso8601String(),
                ];
            })
            ->values();

        return Inertia::render('settings/connected-apps', [
            'grants' => $grants,
        ]);
    }

    public function destroy(Request $request, OAuthUserGrant $grant): RedirectResponse
    {
        $this->authorize('delete', $grant);

        $appName = $grant->registeredApp?->name ?? 'OAuth client';

        $grant->revoke();

        $request->user()->notify(new OAuthGrantRevokedNotification($grant->fresh()));

        return back()->with('status', __('connected_apps.revoked_flash', ['app' => $appName]));
    }
}
