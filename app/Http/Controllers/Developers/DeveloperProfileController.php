<?php

namespace App\Http\Controllers\Developers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Developers\UpsertDeveloperProfileRequest;
use App\Models\Developer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Developer Portal — Ficha pública del dev (Fase 4.2, S4.5).
 *
 * Cada user del portal puede reclamar/mantener una única entrada en
 * `developers`. Es la opción B del plan: en lugar de crear un `Studio`
 * paralelo, reutilizamos la tabla de catálogo — `user_id` separa fichas
 * "claimed" (mantenidas por su dueño) de "manuales" (curadas por admin).
 *
 * Flujo:
 *  - `edit`   — pantalla única de alta/edición. Si el user ya tiene ficha,
 *               carga datos; si no, muestra formulario vacío para claim.
 *  - `store`  — primera alta. Falla con 409 si ya existe (protección ante
 *               doble submit); el cliente debe usar `update` tras refrescar.
 *  - `update` — modifica la ficha existente. Slug regenerado server-side.
 */
class DeveloperProfileController extends Controller
{
    /**
     * Pantalla de alta/edición de la ficha pública del dev autenticado.
     */
    public function edit(Request $request): Response
    {
        $profile = $this->ownedProfile($request);

        return Inertia::render('developers/dashboard/profile/edit', [
            'profile' => $profile ? [
                'id' => $profile->id,
                'name' => $profile->name,
                'slug' => $profile->slug,
                'website_url' => $profile->website_url,
                'bio' => $profile->bio,
                'logo_url' => $profile->logo_url,
                'games_count' => $profile->games()->count(),
                'created_at' => $profile->created_at?->toIso8601String(),
                'updated_at' => $profile->updated_at?->toIso8601String(),
            ] : null,
        ]);
    }

    /**
     * Crea la ficha inicial del dev. Sólo si no existe otra ya reclamada.
     */
    public function store(UpsertDeveloperProfileRequest $request): RedirectResponse
    {
        abort_if(
            $this->ownedProfile($request) !== null,
            409,
            __('developers.profile.already_claimed'),
        );

        $data = $request->validated();

        Developer::create([
            'name' => $data['name'],
            'slug' => $this->uniqueSlug($data['name']),
            'user_id' => $request->user()->id,
            'website_url' => $data['website_url'] ?? null,
            'bio' => $data['bio'] ?? null,
            'logo_url' => $data['logo_url'] ?? null,
        ]);

        return to_route('developers.profile.edit')
            ->with('status', 'developers.profile.created');
    }

    /**
     * Actualiza la ficha del dev autenticado.
     */
    public function update(UpsertDeveloperProfileRequest $request): RedirectResponse
    {
        $profile = $this->ownedProfile($request);

        abort_if($profile === null, 404);

        $data = $request->validated();

        $profile->update([
            'name' => $data['name'],
            'slug' => $profile->name === $data['name']
                ? $profile->slug
                : $this->uniqueSlug($data['name'], $profile->id),
            'website_url' => $data['website_url'] ?? null,
            'bio' => $data['bio'] ?? null,
            'logo_url' => $data['logo_url'] ?? null,
        ]);

        return to_route('developers.profile.edit')
            ->with('status', 'developers.profile.updated');
    }

    /**
     * Devuelve la ficha del user autenticado (o null si aún no la reclamó).
     */
    private function ownedProfile(Request $request): ?Developer
    {
        return Developer::query()
            ->where('user_id', $request->user()->id)
            ->first();
    }

    /**
     * Genera un slug único dentro de `developers`, ignorando el propio
     * registro cuando venga de un update que cambia el nombre.
     */
    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'dev-'.Str::lower(Str::random(6));
        }

        $slug = $base;
        $suffix = 2;
        while (
            Developer::query()
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
