<?php

namespace App\Http\Controllers\Settings;

use App\Enums\FacialControlUsage;
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

        // Crear un perfil de gestos implica usar la cámara: quien la tenía
        // en "no la uso" pasa a "la uso a veces". A quien juega con ella no
        // se le baja el perfil.
        $settings = $user->settings()->firstOrCreate(['user_id' => $user->id]);

        if (! $settings->facial_control_usage->usesCamera()) {
            $settings->update(['facial_control_usage' => FacialControlUsage::Occasional]);
        }

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
