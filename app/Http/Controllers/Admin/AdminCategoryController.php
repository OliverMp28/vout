<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCategoryRequest;
use App\Http\Requests\Admin\UpdateCategoryRequest;
use App\Models\Category;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Panel de Administración — CRUD de categorías (Fase 4.2, S4).
 *
 * Mantenimiento del catálogo de géneros/categorías para los juegos.
 * Eliminar una categoría con juegos asociados está bloqueado (422).
 */
class AdminCategoryController extends Controller
{
    /**
     * Listado paginado de categorías con búsqueda y conteo de juegos.
     */
    public function index(Request $request): Response
    {
        $query = Category::query()->withCount('games');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('name', 'like', "%{$search}%");
        }

        $categories = $query->orderBy('name')->paginate(20)->withQueryString();

        return Inertia::render('admin/categories/index', [
            'categories' => $categories,
            'filters' => $request->only(['search']),
        ]);
    }

    /**
     * Formulario de creación.
     */
    public function create(): Response
    {
        return Inertia::render('admin/categories/create');
    }

    /**
     * Persistir nueva categoría. El slug se genera automáticamente del nombre.
     */
    public function store(StoreCategoryRequest $request): RedirectResponse
    {
        $name = $request->validated('name');

        $category = Category::create([
            'name' => $name,
            'slug' => Str::slug($name),
        ]);

        Audit::record($request->user(), 'category.created', $category);

        return to_route('admin.categories.index')
            ->with('status', 'admin.categories.created');
    }

    /**
     * Formulario de edición.
     */
    public function edit(Category $category): Response
    {
        return Inertia::render('admin/categories/edit', [
            'category' => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'games_count' => $category->games()->count(),
                'created_at' => $category->created_at?->toIso8601String(),
                'updated_at' => $category->updated_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Actualizar categoría. El slug se regenera del nombre.
     */
    public function update(UpdateCategoryRequest $request, Category $category): RedirectResponse
    {
        $name = $request->validated('name');

        $category->update([
            'name' => $name,
            'slug' => Str::slug($name),
        ]);

        Audit::record($request->user(), 'category.updated', $category);

        return to_route('admin.categories.edit', $category)
            ->with('status', 'admin.categories.updated');
    }

    /**
     * Eliminación. Bloqueada si tiene juegos asociados.
     */
    public function destroy(Request $request, Category $category): RedirectResponse
    {
        abort_if(
            $category->games()->exists(),
            422,
            __('admin.categories.has_games'),
        );

        Audit::record($request->user(), 'category.destroyed', $category, [
            'name' => $category->name,
        ]);

        $category->delete();

        return to_route('admin.categories.index')
            ->with('status', 'admin.categories.destroyed');
    }
}
