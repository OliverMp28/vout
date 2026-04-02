<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\ToggleSavedRequest;
use App\Models\Game;
use Illuminate\Http\RedirectResponse;

class SavedController extends Controller
{
    /**
     * Alterna el estado guardado del juego para el usuario autenticado.
     *
     * Preserva los demás campos del pivote al actualizar solo is_saved.
     * Devuelve back() porque la UI es optimista: el estado ya se actualizó en el cliente.
     */
    public function toggle(ToggleSavedRequest $request, Game $game): RedirectResponse
    {
        $user = $request->user();

        $current = $user->games()
            ->where('game_id', $game->id)
            ->first()?->pivot?->is_saved ?? false;

        $user->games()->syncWithoutDetaching([
            $game->id => ['is_saved' => ! $current],
        ]);

        return back();
    }
}
