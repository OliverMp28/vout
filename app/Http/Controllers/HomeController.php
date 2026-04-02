<?php

namespace App\Http\Controllers;

use App\Http\Resources\GameResource;
use App\Models\Game;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class HomeController extends Controller
{
    /**
     * Página principal de Vout: Catalog Home.
     *
     * Muestra juegos destacados y populares sin requerir autenticación.
     * Es la primera impresión del portal — combina identidad de marca
     * con valor inmediato (los juegos visibles desde el primer scroll).
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
            ->limit(12);

        if ($user) {
            $featuredQuery->withUserInteraction($user->id);
            $popularQuery->withUserInteraction($user->id);
        }

        return Inertia::render('welcome', [
            'featured' => GameResource::collection($featuredQuery->get()),
            'popular' => GameResource::collection($popularQuery->get()),
            'canRegister' => Features::enabled(Features::registration()),
        ]);
    }
}
