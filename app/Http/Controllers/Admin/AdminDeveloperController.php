<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreDeveloperRequest;
use App\Http\Requests\Admin\UpdateDeveloperRequest;
use App\Models\Developer;
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
 */
class AdminDeveloperController extends Controller
{
    /**
     * Listado paginado de developers con búsqueda y conteo de juegos.
     */
    public function index(Request $request): Response
    {
        $query = Developer::query()->withCount('games');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('name', 'like', "%{$search}%");
        }

        $developers = $query->orderBy('name')->paginate(20)->withQueryString();

        return Inertia::render('admin/developers/index', [
            'developers' => $developers,
            'filters' => $request->only(['search']),
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
     * Persistir nuevo developer. El slug se genera automáticamente del nombre.
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
     * Formulario de edición.
     */
    public function edit(Developer $developer): Response
    {
        return Inertia::render('admin/developers/edit', [
            'developer' => [
                'id' => $developer->id,
                'name' => $developer->name,
                'slug' => $developer->slug,
                'website_url' => $developer->website_url,
                'bio' => $developer->bio,
                'logo_url' => $developer->logo_url,
                'games_count' => $developer->games()->count(),
                'created_at' => $developer->created_at?->toIso8601String(),
                'updated_at' => $developer->updated_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Actualizar developer. El slug se regenera del nombre.
     */
    public function update(UpdateDeveloperRequest $request, Developer $developer): RedirectResponse
    {
        $data = $request->validated();

        $developer->update([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'website_url' => $data['website_url'] ?? null,
            'bio' => $data['bio'] ?? null,
            'logo_url' => $data['logo_url'] ?? null,
        ]);

        Audit::record($request->user(), 'developer.updated', $developer);

        return to_route('admin.developers.edit', $developer)
            ->with('status', 'admin.developers.updated');
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
}
