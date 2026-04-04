<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\StoreGestureConfigRequest;
use App\Http\Requests\Settings\UpdateGestureConfigRequest;
use App\Models\GestureConfig;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class GestureConfigController extends Controller
{
    /**
     * Almacena un nuevo perfil de configuración de gestos.
     *
     * Si el nuevo perfil se marca como activo, se desactivan
     * todos los demás perfiles del mismo usuario primero.
     */
    public function store(StoreGestureConfigRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        if ($validated['is_active'] ?? false) {
            $user->gestureConfigs()->update(['is_active' => false]);
        }

        $user->gestureConfigs()->create($validated);

        // Asegurar que gestures_enabled esté activo en las preferencias del usuario.
        // Crear un perfil de gestos implica querer tener los controles activados.
        $user->settings()->updateOrCreate(
            ['user_id' => $user->id],
            ['gestures_enabled' => true]
        );

        return back();
    }

    /**
     * Actualiza un perfil de configuración de gestos existente.
     */
    public function update(UpdateGestureConfigRequest $request, GestureConfig $gestureConfig): RedirectResponse
    {
        if ($gestureConfig->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validated();

        // Desactivar perfiles hermanos al activar este.
        if ($validated['is_active'] ?? false) {
            $request->user()
                ->gestureConfigs()
                ->where('id', '!=', $gestureConfig->id)
                ->update(['is_active' => false]);
        }

        $gestureConfig->update($validated);

        return back();
    }

    /**
     * Elimina un perfil de configuración de gestos.
     */
    public function destroy(Request $request, GestureConfig $gestureConfig): RedirectResponse
    {
        if ($gestureConfig->user_id !== $request->user()->id) {
            abort(403);
        }

        $gestureConfig->delete();

        return back();
    }
}
