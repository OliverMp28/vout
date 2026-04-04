<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AppearanceController extends Controller
{
    /**
     * Muestra la página de configuración de apariencia.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();

        $activeGestureConfig = $user->gestureConfigs()
            ->where('is_active', true)
            ->first();

        return Inertia::render('settings/appearance', [
            'activeGestureConfig' => $activeGestureConfig,
        ]);
    }
}
