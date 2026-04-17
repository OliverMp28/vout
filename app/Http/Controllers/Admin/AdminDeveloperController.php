<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReassignDeveloperOwnerRequest;
use App\Http\Requests\Admin\StoreDeveloperRequest;
use App\Http\Requests\Admin\UpdateDeveloperRequest;
use App\Models\Developer;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Panel de Administración — CRUD de developers/estudios (Fase 4.2, S4).
 *
 * Mantenimiento del catálogo de desarrolladores vinculados a juegos.
 * Eliminar un developer con juegos asociados está bloqueado (422).
 *
 * Desde S4.5, cada ficha puede estar reclamada por un usuario del portal
 * (`user_id != null`) — quien la mantiene desde su propio dashboard. El
 * admin conserva la capacidad de reasignar o desvincular el titular con
 * un audit log de la acción; la edición de los campos del perfil sigue
 * viva en el admin para moderar contenido en casos excepcionales.
 */
class AdminDeveloperController extends Controller
{
    /**
     * Listado paginado de developers con búsqueda, filtro claimed/manual
     * y conteo de juegos. El `owner` viaja eager-loaded para que el UI
     * pueda distinguir visualmente fichas reclamadas de manuales sin un
     * N+1.
     */
    public function index(Request $request): Response
    {
        $query = Developer::query()
            ->with('user:id,name,email,username')
            ->withCount('games');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('name', 'like', "%{$search}%");
        }

        $claimed = $request->input('claimed', 'all');
        if ($claimed === 'claimed') {
            $query->claimed();
        } elseif ($claimed === 'manual') {
            $query->manual();
        }

        $developers = $query->orderBy('name')->paginate(20)->withQueryString();

        $developers->getCollection()->transform(
            fn (Developer $dev): array => $this->serializeListItem($dev),
        );

        return Inertia::render('admin/developers/index', [
            'developers' => $developers,
            'filters' => [
                'search' => $request->input('search'),
                'claimed' => $claimed,
            ],
        ]);
    }

    /**
     * Formulario de creación.
     */
    public function create(): Response
    {
        return Inertia::render('admin/developers/create');
    }

    /**
     * Persistir nuevo developer manual (ficha sin user_id). Las fichas
     * reclamadas nacen desde el Developer Portal — el admin sólo las
     * reasigna o desvincula, nunca las crea con titular.
     */
    public function store(StoreDeveloperRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $developer = Developer::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'website_url' => $data['website_url'] ?? null,
            'bio' => $data['bio'] ?? null,
            'logo_url' => $data['logo_url'] ?? null,
        ]);

        Audit::record($request->user(), 'developer.created', $developer);

        return to_route('admin.developers.index')
            ->with('status', 'admin.developers.created');
    }

    /**
     * Formulario de edición. Adjunta la lista de usuarios aún sin ficha
     * (para el combo de reasignación) — la restricción unique en
     * `developers.user_id` obliga a filtrarlos.
     */
    public function edit(Developer $developer): Response
    {
        $developer->load('user:id,name,email,username');

        return Inertia::render('admin/developers/edit', [
            'developer' => $this->serializeDetail($developer),
            'reassign_candidates' => $this->reassignCandidates($developer),
        ]);
    }

    /**
     * Actualizar campos de contenido del developer. El slug se regenera
     * del nombre sólo si cambia — preserva URLs públicas cuando sólo
     * se edita la bio o el logo.
     */
    public function update(UpdateDeveloperRequest $request, Developer $developer): RedirectResponse
    {
        $data = $request->validated();

        $developer->update([
            'name' => $data['name'],
            'slug' => $developer->name === $data['name']
                ? $developer->slug
                : $this->uniqueSlug($data['name'], $developer->id),
            'website_url' => $data['website_url'] ?? null,
            'bio' => $data['bio'] ?? null,
            'logo_url' => $data['logo_url'] ?? null,
        ]);

        Audit::record($request->user(), 'developer.updated', $developer);

        return to_route('admin.developers.edit', $developer)
            ->with('status', 'admin.developers.updated');
    }

    /**
     * Reasigna o desvincula el `user_id` de una ficha. `user_id = null`
     * convierte la ficha en manual (el ex-titular puede volver a reclamar
     * cualquier ficha libre). Un `user_id` nuevo requiere que ese user
     * no tenga ya otra ficha reclamada (unique).
     */
    public function reassign(
        ReassignDeveloperOwnerRequest $request,
        Developer $developer,
    ): RedirectResponse {
        $newUserId = $request->validated('user_id');
        $previousUserId = $developer->user_id;

        $developer->update(['user_id' => $newUserId]);

        Audit::record(
            $request->user(),
            $newUserId === null
                ? 'developer.owner_cleared'
                : 'developer.owner_reassigned',
            $developer,
            [
                'previous_user_id' => $previousUserId,
                'new_user_id' => $newUserId,
            ],
        );

        return to_route('admin.developers.edit', $developer)
            ->with(
                'status',
                $newUserId === null
                    ? 'admin.developers.owner_cleared'
                    : 'admin.developers.owner_reassigned',
            );
    }

    /**
     * Eliminación. Bloqueada si tiene juegos asociados.
     */
    public function destroy(Request $request, Developer $developer): RedirectResponse
    {
        abort_if(
            $developer->games()->exists(),
            422,
            __('admin.developers.has_games'),
        );

        Audit::record($request->user(), 'developer.destroyed', $developer, [
            'name' => $developer->name,
        ]);

        $developer->delete();

        return to_route('admin.developers.index')
            ->with('status', 'admin.developers.destroyed');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeListItem(Developer $dev): array
    {
        return [
            'id' => $dev->id,
            'name' => $dev->name,
            'slug' => $dev->slug,
            'website_url' => $dev->website_url,
            'bio' => $dev->bio,
            'logo_url' => $dev->logo_url,
            'games_count' => (int) $dev->games_count,
            'created_at' => $dev->created_at?->toIso8601String(),
            'updated_at' => $dev->updated_at?->toIso8601String(),
            'owner' => $dev->user ? [
                'id' => $dev->user->id,
                'name' => $dev->user->name,
                'email' => $dev->user->email,
                'username' => $dev->user->username,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDetail(Developer $dev): array
    {
        return array_merge($this->serializeListItem($dev), [
            'games_count' => $dev->games()->count(),
        ]);
    }

    /**
     * Usuarios elegibles como nuevo titular: los que no han reclamado
     * ninguna ficha todavía, más el titular actual (para que el combo
     * no lo omita si el admin abre el modal de reasignación estando ya
     * asignado). La restricción unique de la columna rechazaría cualquier
     * otra fila.
     *
     * @return list<array{id:int,name:string,email:string,username:string}>
     */
    private function reassignCandidates(Developer $developer): array
    {
        return User::query()
            ->select(['id', 'name', 'email', 'username'])
            ->where(function ($query) use ($developer): void {
                $query->whereDoesntHave('developerProfile');
                if ($developer->user_id !== null) {
                    $query->orWhere('id', $developer->user_id);
                }
            })
            ->orderBy('name')
            ->limit(200)
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
            ])
            ->all();
    }

    /**
     * Generador de slug único dentro de `developers`, permitiendo que el
     * propio developer mantenga el suyo durante un update.
     */
    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'developer-'.Str::lower(Str::random(6));
        }

        $slug = $base;
        $suffix = 2;
        while (Developer::query()
            ->where('slug', $slug)
            ->when($ignoreId !== null, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists()
        ) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
