<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Controllers\Controller;
use App\Http\Resources\GameResource;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserLibraryController extends Controller
{
    /**
     * Juegos marcados como favoritos por el usuario autenticado.
     */
    public function favorites(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $games = $user->games()
            ->wherePivot('is_favorite', true)
            ->with('categories:id,name,slug')
            ->withPivot('is_favorite', 'is_saved', 'play_count', 'best_score', 'last_played_at')
            ->latest('game_user.updated_at')
            ->cursorPaginate(24)
            ->withQueryString();

        return Inertia::render('catalog/library/favorites', [
            'games' => GameResource::collection($games),
        ]);
    }

    /**
     * Juegos guardados por el usuario autenticado.
     */
    public function saved(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $games = $user->games()
            ->wherePivot('is_saved', true)
            ->with('categories:id,name,slug')
            ->withPivot('is_favorite', 'is_saved', 'play_count', 'best_score', 'last_played_at')
            ->latest('game_user.updated_at')
            ->cursorPaginate(24)
            ->withQueryString();

        return Inertia::render('catalog/library/saved', [
            'games' => GameResource::collection($games),
        ]);
    }
}
