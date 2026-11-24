<?php

namespace App\Http\Controllers;

use App\Enums\FacialControlSupport;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\GameResource;
use App\Models\Category;
use App\Models\Game;
use App\Services\DashboardDataService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class HomeController extends Controller
{
    public function __construct(
        private readonly DashboardDataService $dashboard,
    ) {}

    /**
     * Portada de Vout, sin autenticación: los destacados, los juegos que se
     * manejan con gestos (primero los hechos para ello), los más jugados, los
     * recién llegados y las categorías. Quien tiene cuenta ve además sus
     * últimas partidas para seguir jugando.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $featuredQuery = Game::query()
            ->active()
            ->featured()
            ->with(['categories:id,name,slug', 'developers:id,name,slug,logo_url'])
            ->sortedBy('popular')
            ->limit(6);

        $popularQuery = Game::query()
            ->active()
            ->with(['categories:id,name,slug'])
            ->sortedBy('popular')
            ->limit(11);

        $gestureQuery = Game::query()
            ->active()
            ->playableWithFace()
            ->with(['categories:id,name,slug'])
            ->orderByRaw('CASE WHEN games.facial_control_support = ? THEN 0 ELSE 1 END', [FacialControlSupport::Designed->value])
            ->sortedBy('popular')
            ->limit(4);

        $newestQuery = Game::query()
            ->active()
            ->with(['categories:id,name,slug'])
            ->latest('games.created_at')
            ->limit(4);

        if ($user) {
            $featuredQuery->withUserInteraction($user->id);
            $popularQuery->withUserInteraction($user->id);
            $gestureQuery->withUserInteraction($user->id);
            $newestQuery->withUserInteraction($user->id);
        }

        // La misma lista que el catálogo (cacheada un día): solo las que tienen juegos.
        $categories = Cache::remember(
            'catalog:categories:all',
            now()->addDay(),
            fn () => Category::query()->withCount('games')->orderBy('name')->get(),
        )->filter(fn (Category $category): bool => $category->games_count > 0)->values();

        return Inertia::render('welcome', [
            'featured' => GameResource::collection($featuredQuery->get()),
            'popular' => GameResource::collection($popularQuery->get()),
            'gestureGames' => GameResource::collection($gestureQuery->get()),
            'newest' => GameResource::collection($newestQuery->get()),
            'recentGames' => GameResource::collection(
                $user ? $this->dashboard->recentlyPlayed($user) : collect(),
            ),
            'categories' => CategoryResource::collection($categories),
            'canRegister' => Features::enabled(Features::registration()),
        ]);
    }
}
