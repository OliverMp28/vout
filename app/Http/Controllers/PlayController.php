<?php

namespace App\Http\Controllers;

use App\Jobs\IncrementGamePlayCount;
use App\Models\Game;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Fase 3.3 — Reproductor de juegos embebidos.
 *
 * Sirve la página que carga el juego en un iFrame y gestiona
 * el contexto necesario para el handshake de identidad seguro:
 *
 *   1. Carga el juego por slug (route model binding).
 *   2. Resuelve la configuración de gestos activa del usuario.
 *   3. Emite un Personal Access Token con scope `game:play` para
 *      que el iFrame pueda identificar al usuario sin exponer datos extra.
 *
 * El token viaja al iFrame EXCLUSIVAMENTE por postMessage (nunca por URL).
 * Ver: useIframeHandshake.ts y el protocolo en plan-3.3.md.
 */
class PlayController extends Controller
{
    /**
     * Muestra la página de juego embebido con iFrame.
     *
     * Solo juegos activos son accesibles. Los inactivos devuelven 404
     * para no revelar su existencia a través del portal.
     */
    public function show(Request $request, Game $game): Response
    {
        abort_if(! $game->is_active, 404);

        $user = $request->user();

        // ── Configuración de gestos activa ────────────────────────────────────
        // Utiliza el mismo patrón que AppearanceController: una sola query que
        // carga la primera config activa. El frontend decide si iniciar el motor.
        $activeGestureConfig = $user?->gestureConfigs()
            ->where('is_active', true)
            ->first();

        // ── Token de sesión de juego (mínimo privilegio) ──────────────────────
        // Se genera un PAT por cada visita a la página de juego.
        // Scope `game:play`: identifica al usuario en el iFrame sin más permisos.
        // El token llega al iFrame sólo vía postMessage en el handshake READY.
        $accessToken = $user?->createToken(
            name: 'game-session:'.$game->slug,
            scopes: ['game:play'],
        )->accessToken;

        // Fase 3.4 — Registra la partida tras enviar la respuesta para no
        // bloquear el render del iFrame. `dispatchAfterResponse` corre en el
        // mismo proceso después de flush HTTP, sin depender de un queue worker.
        if ($user !== null) {
            IncrementGamePlayCount::dispatchAfterResponse($user->id, $game->id);
        }

        return Inertia::render('play/game', [
            // Datos públicos del juego que el frontend necesita para el iFrame.
            // No usamos GameResource porque las props de juego aquí son distintas
            // a las del catálogo (necesitamos effective_origins, no paginación).
            'game' => [
                'name' => $game->name,
                'slug' => $game->slug,
                'description' => $game->description,
                'cover_image' => $game->cover_image,
                'embed_url' => $game->embed_url,
                'effective_origins' => $game->effective_origins,
            ],

            // Null si el usuario no tiene config activa → el frontend deshabilita el motor.
            'activeGestureConfig' => $activeGestureConfig,

            // Null si el usuario no está autenticado (no debería llegar aquí
            // gracias al middleware 'auth', pero lo tipamos correctamente).
            'accessToken' => $accessToken,
        ]);
    }
}
