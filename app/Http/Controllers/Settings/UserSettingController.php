<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserSettingController extends Controller
{
    /**
     * Actualiza preferencias del usuario. Cada campo es opcional para que
     * los controles puedan persistir de forma independiente:
     *   - los tabs de tema envían sólo `appearance`
     *   - el formulario de Apariencia envía `show_mascot` + `gestures_enabled`
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'appearance' => ['sometimes', 'required', Rule::in(['light', 'dark', 'system'])],
            'show_mascot' => ['sometimes', 'required', 'boolean'],
            'gestures_enabled' => ['sometimes', 'required', 'boolean'],
        ]);

        $user = $request->user();

        $settings = $user->settings()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'appearance' => 'system',
                'show_mascot' => true,
                'gestures_enabled' => false,
            ]
        );

        if (! empty($validated)) {
            $settings->update($validated);
        }

        return back();
    }
}
