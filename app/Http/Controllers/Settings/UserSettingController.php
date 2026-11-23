<?php

namespace App\Http\Controllers\Settings;

use App\Enums\FacialControlUsage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateUserSettingRequest;
use Illuminate\Http\RedirectResponse;

class UserSettingController extends Controller
{
    /**
     * Actualiza preferencias del usuario. Cada campo es opcional para que
     * cada control se guarde por separado al cambiarlo (ver el Form Request).
     *
     * El encendido automático de la cámara solo tiene sentido con "juego con
     * la cámara": al cambiar a otro perfil se apaga, para que volver a elegir
     * ese perfil no lo reactive sin que el usuario lo vea. Y al cambiar de
     * perfil, el panel de la página de juego vuelve a abrirse o cerrarse
     * según el perfil nuevo (se olvida cómo lo dejó con el anterior).
     */
    public function update(UpdateUserSettingRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        $settings = $user->settings()->firstOrCreate(['user_id' => $user->id]);

        $settings->fill($validated);

        if ($settings->isDirty('facial_control_usage')) {
            $settings->play_panel_open = null;
        }

        if ($settings->facial_control_usage !== FacialControlUsage::Primary) {
            $settings->camera_autostart = false;
        }

        $settings->save();

        return back();
    }
}
