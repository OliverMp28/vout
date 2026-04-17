<?php

namespace App\Http\Controllers;

use App\Http\Resources\GameResource;
use App\Services\DashboardDataService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardDataService $dashboard) {}

    /**
     * Dashboard Estratégico (Fase 2.5).
     *
     * Cockpit personal del usuario: continuidad de juego, estadísticas
     * rápidas, recomendaciones personalizadas, contexto del ecosistema
     * (dev/admin) y onboarding guiado dismissible para usuarios nuevos.
     */
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        $continuePlaying = $this->dashboard->continuePlaying($user);
        $recommendations = $this->dashboard->recommendations($user);

        return Inertia::render('dashboard', [
            'greeting' => [
                'name' => $user->name,
                'hourOfDay' => (int) now()->format('G'),
            ],
            'continuePlaying' => $continuePlaying !== null
                ? new GameResource($continuePlaying)
                : null,
            'stats' => $this->dashboard->quickStats($user),
            'recommendations' => GameResource::collection($recommendations),
            'recommendationReason' => $this->dashboard->recommendationReason($user),
            'ecosystem' => [
                'voutId' => (string) $user->vout_id,
                ...$this->dashboard->ecosystemContext($user),
            ],
            'onboarding' => $this->dashboard->onboardingState($user),
        ]);
    }

    /**
     * Marca el hero de onboarding del dashboard como descartado por el user.
     *
     * Crea el registro `user_settings` si no existe (firstOrCreate pattern).
     */
    public function dismissWelcome(Request $request): RedirectResponse
    {
        $user = $request->user();

        $settings = $user->settings()->firstOrCreate([]);
        $settings->update(['dashboard_welcome_dismissed_at' => now()]);

        return back();
    }
}
