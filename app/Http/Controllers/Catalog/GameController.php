<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\GameIndexRequest;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\GameResource;
use App\Models\Category;
use App\Models\Game;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class GameController extends Controller
{
    /**
     * Catálogo principal de juegos con filtros, búsqueda y paginación cursor.
     *
     * - Acceso público (guests y usuarios autenticados).
     * - Los resultados para guests se cachean 5 minutos por combinación de filtros.
     * - Para usuarios autenticados no se cachea porque la respuesta incluye
     *   datos de interacción personal (is_favorite, is_saved, etc.).
     */
    public function index(GameIndexRequest $request): Response
    {
        $filters = $request->filters();
        $user = $request->user();

        $categories = Cache::remember(
            'catalog:categories:all',
            now()->addDay(),
            fn () => Category::query()->withCount('games')->orderBy('name')->get(),
        );

        $games = $this->buildCatalogQuery($filters, $user?->id)
            ->cursorPaginate(24)
            ->withQueryString();

        return Inertia::render('catalog/index', [
            'games' => GameResource::collection($games),
            'filters' => $filters,
            'categories' => CategoryResource::collection($categories),
        ]);
    }

    /**
     * Página de detalle de un juego individual.
     *
     * Shell preparada para el reproductor iFrame de la Fase 3.
     */
    public function show(Game $game): Response
    {
        abort_if(! $game->is_active, 404);

        $game->load(['categories:id,name,slug', 'developers:id,name,slug,logo_url,website_url,bio']);

        $user = request()->user();

        if ($user) {
            $userInteraction = $user->games()
                ->where('game_id', $game->id)
                ->first()?->pivot;
        }

        $related = Game::query()
            ->active()
            ->whereNot('id', $game->id)
            ->whereHas('categories', fn ($q) => $q->whereIn(
                'categories.id',
                $game->categories->pluck('id'),
            ))
            ->with('categories:id,name,slug')
            ->inRandomOrder()
            ->limit(6)
            ->get();

        return Inertia::render('catalog/show', [
            'game' => new GameResource($game),
            'userInteraction' => $user && $userInteraction ? [
                'is_favorite' => (bool) $userInteraction->is_favorite,
                'is_saved' => (bool) $userInteraction->is_saved,
                'play_count_user' => (int) $userInteraction->play_count,
                'best_score' => $userInteraction->best_score !== null ? (int) $userInteraction->best_score : null,
                'last_played_at' => $userInteraction->last_played_at,
            ] : null,
            'related' => GameResource::collection($related),
        ]);
    }

    /**
     * Construye la query del catálogo aplicando filtros, scopes y eager loading.
     *
     * @param  array{categories: list<string>, search: string, sort: string}  $filters
     */
    private function buildCatalogQuery(array $filters, ?int $userId): Builder
    {
        $query = Game::query()
            ->active()
            ->with(['categories:id,name,slug', 'developers:id,name,slug,logo_url'])
            ->inCategories($filters['categories'])
            ->search($filters['search'])
            ->sortedBy($filters['sort']);

        if ($userId !== null) {
            $query->withUserInteraction($userId);
        }

        return $query;
    }
}
