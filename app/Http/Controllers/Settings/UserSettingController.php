<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class UserSettingController extends Controller
{
    /**
     * Update the user's settings (appearance, mascot, gestures).
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'dark_mode' => ['required', 'boolean'],
            'show_mascot' => ['required', 'boolean'],
            'gestures_enabled' => ['required', 'boolean'],
        ]);

        $user = $request->user();

        // Obtener o crear configuraciones si no existen
        $settings = $user->settings()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'dark_mode' => true,
                'show_mascot' => true,
                'gestures_enabled' => false,
            ]
        );

        $settings->update($validated);

        return back();
    }
}
