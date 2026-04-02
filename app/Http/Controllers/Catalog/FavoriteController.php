<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\ToggleFavoriteRequest;
use App\Models\Game;
use Illuminate\Http\RedirectResponse;

class FavoriteController extends Controller
{
    /**
     * Alterna el estado de favorito del juego para el usuario autenticado.
     *
     * Usa syncWithoutDetaching para preservar los demás campos del pivote
     * (is_saved, play_count, best_score) al actualizar solo is_favorite.
     * Devuelve back() porque la UI es optimista: el estado ya se actualizó en el cliente.
     */
    public function toggle(ToggleFavoriteRequest $request, Game $game): RedirectResponse
    {
        $user = $request->user();

        $current = $user->games()
            ->where('game_id', $game->id)
            ->first()?->pivot?->is_favorite ?? false;

        $user->games()->syncWithoutDetaching([
            $game->id => ['is_favorite' => ! $current],
        ]);

        return back();
    }
}
