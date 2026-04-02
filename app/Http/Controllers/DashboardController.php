<?php

namespace App\Http\Controllers;

use App\Http\Resources\GameResource;
use App\Models\Game;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Panel personal del usuario autenticado.
     *
     * Muestra favoritos, jugados recientemente y destacados del catálogo.
     * La interacción del usuario se adjunta vía scopeWithUserInteraction.
     */
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        $favorites = Game::query()
            ->active()
            ->withUserInteraction($user->id)
            ->whereRaw('user_pivot.is_favorite = 1')
            ->with(['categories:id,name,slug'])
            ->orderByRaw('COALESCE(user_pivot.last_played_at, 0) DESC')
            ->limit(6)
            ->get();

        $recentlyPlayed = Game::query()
            ->active()
            ->withUserInteraction($user->id)
            ->whereRaw('user_pivot.last_played_at IS NOT NULL')
            ->with(['categories:id,name,slug'])
            ->orderByRaw('user_pivot.last_played_at DESC')
            ->limit(4)
            ->get();

        $featured = Game::query()
            ->active()
            ->featured()
            ->withUserInteraction($user->id)
            ->with(['categories:id,name,slug'])
            ->sortedBy('popular')
            ->limit(6)
            ->get();

        return Inertia::render('dashboard', [
            'favorites' => GameResource::collection($favorites),
            'recentlyPlayed' => GameResource::collection($recentlyPlayed),
            'featured' => GameResource::collection($featured),
        ]);
    }
}
