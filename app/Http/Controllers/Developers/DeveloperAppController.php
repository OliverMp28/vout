<?php

namespace App\Http\Controllers\Developers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Developers\StoreDeveloperAppRequest;
use App\Http\Requests\Developers\UpdateDeveloperAppRequest;
use App\Models\RegisteredApp;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Passport\Client;
use Laravel\Passport\ClientRepository;
use Laravel\Passport\Passport;

/**
 * Developer Portal — CRUD de aplicaciones del ecosistema (Fase 4.1).
 *
 * Gestiona las aplicaciones registradas por cada desarrollador: creación,
 * listado, edición, regeneración de secretos, activación/pausa y borrado.
 *
 * La tabla `registered_apps` se sincroniza atómicamente con `oauth_clients`
 * cuando la app declara `requires_auth=true` (perfil "App con IdP").
 * Para apps cliente-puro (`requires_auth=false`) no se crea client OAuth.
 *
 * Autorización: policy `RegisteredAppPolicy` vía `authorizeResource`.
 */
class DeveloperAppController extends Controller
{
    use AuthorizesRequests;

    /**
     * Listado de apps del usuario autenticado.
     */
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', RegisteredApp::class);

        $apps = $request->user()->registeredApps()
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'slug', 'app_url', 'is_active', 'requires_auth', 'oauth_client_id', 'updated_at']);

        return Inertia::render('developers/dashboard/index', [
            'apps' => $apps,
        ]);
    }

    /**
     * Formulario de creación.
     */
    public function create(): Response
    {
        $this->authorize('create', RegisteredApp::class);

        return Inertia::render('developers/dashboard/create');
    }

    /**
     * Crea una app y, si `requires_auth`, su client OAuth asociado
     * en una única transacción. El secreto en claro se devuelve
     * una sola vez vía flash `created_client_secret`.
     */
    public function store(StoreDeveloperAppRequest $request, ClientRepository $clientRepo): RedirectResponse
    {
        $this->authorize('create', RegisteredApp::class);

        $data = $request->validated();
        $user = $request->user();

        [$app, $plainSecret] = DB::transaction(function () use ($data, $user, $clientRepo): array {
            $clientId = null;
            $plainSecret = null;

            if ($data['requires_auth']) {
                $client = $clientRepo->createAuthorizationCodeGrantClient(
                    name: $data['name'],
                    redirectUris: $data['redirect_uris'],
                    confidential: (bool) $data['confidential'],
                    user: $user,
                );
                $clientId = $client->id;
                $plainSecret = $client->plainSecret;
            }

            $app = RegisteredApp::create([
                'user_id' => $user->id,
                'name' => $data['name'],
                'slug' => $this->uniqueSlug($data['name']),
                'app_url' => $data['app_url'],
                'allowed_origins' => $data['allowed_origins'],
                'is_active' => true,
                'oauth_client_id' => $clientId,
                'is_first_party' => false,
                'requires_auth' => (bool) $data['requires_auth'],
            ]);

            return [$app, $plainSecret];
        });

        $redirect = to_route('developers.apps.show', $app);

        return $plainSecret !== null
            ? $redirect->with('created_client_secret', $plainSecret)
            : $redirect->with('status', 'developers.apps.created');
    }

    /**
     * Detalle con credenciales (sin secreto persistido) + flash
     * `created_client_secret` si viene del flujo create/regenerate.
     */
    public function show(Request $request, RegisteredApp $app): Response
    {
        $this->authorize('view', $app);

        $client = $this->loadClient($app);

        return Inertia::render('developers/dashboard/show', [
            'app' => $app->only([
                'id', 'name', 'slug', 'app_url', 'allowed_origins',
                'is_active', 'requires_auth', 'is_first_party',
                'oauth_client_id', 'created_at', 'updated_at',
            ]),
            'client' => $client ? [
                'id' => $client->id,
                'name' => $client->name,
                'redirect_uris' => $client->redirect_uris,
                'grant_types' => $client->grant_types,
                'revoked' => (bool) $client->revoked,
                'confidential' => $client->confidential(),
            ] : null,
            'created_client_secret' => $request->session()->get('created_client_secret'),
        ]);
    }

    /**
     * Actualiza metadatos editables (app_url, allowed_origins, redirect_uris).
     * Propaga los redirect_uris al client OAuth si existe.
     */
    public function update(UpdateDeveloperAppRequest $request, RegisteredApp $app, ClientRepository $clientRepo): RedirectResponse
    {
        $this->authorize('update', $app);

        $data = $request->validated();

        DB::transaction(function () use ($app, $data, $clientRepo): void {
            $app->fill(array_filter([
                'app_url' => $data['app_url'] ?? null,
                'allowed_origins' => $data['allowed_origins'] ?? null,
            ], fn ($value): bool => $value !== null))->save();

            if ($app->oauth_client_id && array_key_exists('redirect_uris', $data)) {
                $client = $this->loadClient($app);
                if ($client !== null) {
                    $clientRepo->update($client, $app->name, $data['redirect_uris']);
                }
            }
        });

        return to_route('developers.apps.show', $app)
            ->with('status', 'developers.apps.updated');
    }

    /**
     * Regenera el secreto del client OAuth. Sólo aplica a apps con IdP
     * confidenciales. El secreto anterior queda invalidado por el hasher
     * del modelo Client (mutator `secret`).
     */
    public function regenerateSecret(RegisteredApp $app, ClientRepository $clientRepo): RedirectResponse
    {
        $this->authorize('update', $app);

        abort_unless($app->oauth_client_id !== null, 404);

        $client = $this->loadClient($app);
        abort_unless($client !== null && ! $client->revoked, 404);
        abort_unless($client->confidential(), 422);

        $clientRepo->regenerateSecret($client);

        return to_route('developers.apps.show', $app)
            ->with('created_client_secret', $client->plainSecret);
    }

    /**
     * Activa o pausa la app (no afecta al client OAuth: es sólo
     * visibilidad en portal y semáforo de `is_active`).
     */
    public function toggleActive(RegisteredApp $app): RedirectResponse
    {
        $this->authorize('update', $app);

        $app->update(['is_active' => ! $app->is_active]);

        return back()->with(
            'status',
            $app->is_active ? 'developers.apps.activated' : 'developers.apps.paused',
        );
    }

    /**
     * Elimina la app y revoca el client OAuth asociado si existe.
     * `ClientRepository::delete` revoca el client y sus tokens.
     */
    public function destroy(RegisteredApp $app, ClientRepository $clientRepo): RedirectResponse
    {
        $this->authorize('delete', $app);

        DB::transaction(function () use ($app, $clientRepo): void {
            $client = $this->loadClient($app);
            if ($client !== null) {
                $clientRepo->delete($client);
            }
            $app->delete();
        });

        return to_route('developers.dashboard')
            ->with('status', 'developers.apps.deleted');
    }

    /**
     * Resuelve el modelo Client de Passport asociado a la app (o null).
     */
    private function loadClient(RegisteredApp $app): ?Client
    {
        if ($app->oauth_client_id === null) {
            return null;
        }

        return Passport::client()->newQuery()->find($app->oauth_client_id);
    }

    /**
     * Genera un slug único dentro de `registered_apps`.
     * Incrementa un sufijo numérico hasta encontrar hueco para evitar
     * colisiones al crear apps con nombres similares.
     */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'app-'.Str::lower(Str::random(6));
        }

        $slug = $base;
        $suffix = 2;
        while (RegisteredApp::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
