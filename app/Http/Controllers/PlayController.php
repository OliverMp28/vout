<?php

namespace App\Http\Controllers;

use App\Jobs\IncrementGamePlayCount;
use App\Models\Game;
use App\Services\GameSessionTokenIssuer;
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
 *   2. Si el juego es de una app third-party que el usuario aún no ha
 *      autorizado, muestra la pantalla de consentimiento en lugar del juego.
 *   3. Resuelve la configuración de gestos activa del usuario.
 *   4. Emite el token de sesión del juego (`GameSessionTokenIssuer`):
 *      para el client OAuth de la app si lo tiene, de portal si no.
 *
 * El token viaja al iFrame EXCLUSIVAMENTE por postMessage (nunca por URL).
 * Ver: use-iframe-handshake.ts, use-game-session.ts y la sección
 * "Identidad dentro del iFrame" de docs/integration-guide.md.
 */
class PlayController extends Controller
{
    public function __construct(
        private readonly GameSessionTokenIssuer $sessions,
    ) {}

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

        if ($this->sessions->requiresConsent($user, $game)) {
            return $this->consentScreen($game);
        }

        // ── Configuración de gestos activa ────────────────────────────────────
        // Utiliza el mismo patrón que AppearanceController: una sola query que
        // carga la primera config activa. El frontend decide si iniciar el motor.
        $activeGestureConfig = $user->gestureConfigs()
            ->where('is_active', true)
            ->first();

        // ── Token de sesión de juego (mínimo privilegio) ──────────────────────
        // Uno por visita, con la TTL de los access tokens (60 min). El portal lo
        // renueva antes de que caduque vía `Play\SessionTokenController`.
        $session = $this->sessions->issue($user, $game);

        // Fase 3.4 — Registra la partida tras enviar la respuesta para no
        // bloquear el render del iFrame. `dispatchAfterResponse` corre en el
        // mismo proceso después de flush HTTP, sin depender de un queue worker.
        IncrementGamePlayCount::dispatchAfterResponse($user->id, $game->id);

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

            // `{ token, expires_at }` — solo sale del portal por postMessage.
            'session' => $session->toArray(),
        ]);
    }

    /**
     * Pantalla previa al juego: pide al usuario que autorice a la app
     * third-party antes de entregarle su identidad dentro del iFrame.
     */
    private function consentScreen(Game $game): Response
    {
        $app = $game->registeredApp;
        $scopeCatalog = (array) config('vout.scopes', []);

        return Inertia::render('play/consent', [
            'game' => [
                'name' => $game->name,
                'slug' => $game->slug,
            ],
            'app' => [
                'name' => $app->name,
                'app_url' => $app->app_url,
            ],
            'scopes' => array_map(
                static fn (string $id): array => [
                    'id' => $id,
                    'description' => (string) ($scopeCatalog[$id] ?? $id),
                ],
                GameSessionTokenIssuer::APP_SCOPES,
            ),
        ]);
    }
}
