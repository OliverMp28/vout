<?php

namespace App\Http\Controllers;

use App\Enums\AccountRequirement;
use App\Jobs\IncrementGamePlayCount;
use App\Models\Game;
use App\Models\User;
use App\Services\GameSessionTokenIssuer;
use Illuminate\Http\RedirectResponse;
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
 *   2. Decide quién puede jugar según `account_requirement`: sin cuenta
 *      (`none`, `optional`) o solo con una cuenta confirmada (`required`).
 *   3. Si el juego va a recibir la identidad y es de una app third-party
 *      que el usuario aún no ha autorizado, muestra la pantalla de
 *      consentimiento en lugar del juego.
 *   4. Resuelve la configuración de gestos activa del usuario (si lo hay).
 *   5. Emite el token de sesión del juego (`GameSessionTokenIssuer`) solo
 *      si el juego recibe la identidad. Si no, `session` es null y el
 *      portal saluda al juego con `VOUT_GUEST`.
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
    public function show(Request $request, Game $game): Response|RedirectResponse
    {
        abort_if(! $game->is_active, 404);

        $user = $request->user();
        $requirement = $game->account_requirement;

        if (! $requirement->allowsGuests()) {
            if ($user === null) {
                return redirect()->guest(route('login'));
            }

            if (! $user->hasVerifiedEmail()) {
                return to_route('verification.notice');
            }
        }

        // Solo una cuenta confirmada comparte su identidad, y solo con un
        // juego que la usa. En un juego de cuenta opcional se puede elegir
        // jugar sin compartirla (`?guest=1`, desde el consentimiento).
        $sharesIdentity = $user?->hasVerifiedEmail() === true
            && $requirement->sharesIdentity()
            && ! ($requirement->allowsGuests() && $request->boolean('guest'));

        if ($sharesIdentity && $this->sessions->requiresConsent($user, $game)) {
            return $this->consentScreen($game, $requirement);
        }

        // ── Configuración de gestos activa ────────────────────────────────────
        // Utiliza el mismo patrón que AppearanceController: una sola query que
        // carga la primera config activa. El frontend decide si iniciar el motor.
        // Un invitado no tiene: prueba con los controles por defecto, sin guardar.
        $activeGestureConfig = $user?->gestureConfigs()
            ->where('is_active', true)
            ->first();

        // ── Token de sesión de juego (mínimo privilegio) ──────────────────────
        // Uno por visita, con la TTL de los access tokens (60 min). El portal lo
        // renueva antes de que caduque vía `Play\SessionTokenController`.
        $session = $sharesIdentity ? $this->sessions->issue($user, $game) : null;

        // Fase 3.4 — Registra la partida tras enviar la respuesta para no
        // bloquear el render del iFrame. `dispatchAfterResponse` corre en el
        // mismo proceso después de flush HTTP, sin depender de un queue worker.
        // De los invitados no se guarda nada.
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
                // Si recibe los controles de Vout: sin ellos no se ofrece la cámara.
                'facial_control_support' => $game->facial_control_support->value,
                // Si hace falta cuenta: decide qué se le dice a quien juega sin ella.
                'account_requirement' => $requirement->value,
            ],

            // Qué controles eligió el usuario cuando el juego le sugirió los
            // suyos (null si aún no se le ha preguntado; ver PresetChoiceController).
            'presetChoice' => $user?->games()
                ->where('games.id', $game->id)
                ->value('game_user.gesture_preset_choice'),

            // Null si el usuario no tiene config activa → el frontend deshabilita el motor.
            'activeGestureConfig' => $activeGestureConfig,

            // `{ token, expires_at }` — solo sale del portal por postMessage.
            // Null si el juego no recibe la identidad (invitado o juego sin cuenta).
            'session' => $session?->toArray(),

            // Por qué un juego de cuenta opcional no recibe la identidad, para
            // decírselo al jugador; null si la recibe o si el juego no la usa.
            'guestNotice' => $this->guestNotice($user, $requirement, $session !== null),
        ]);
    }

    /**
     * Por qué el juego no recibe la identidad del jugador: `guest` (no ha
     * entrado), `unverified` (no ha confirmado el email) o `declined` (eligió
     * jugar sin compartirla). Solo en juegos de cuenta opcional: en los que no
     * usan la cuenta no hay nada que contar.
     *
     * @return 'guest'|'unverified'|'declined'|null
     */
    private function guestNotice(?User $user, AccountRequirement $requirement, bool $sharesIdentity): ?string
    {
        if ($sharesIdentity || $requirement !== AccountRequirement::Optional) {
            return null;
        }

        return match (true) {
            $user === null => 'guest',
            ! $user->hasVerifiedEmail() => 'unverified',
            default => 'declined',
        };
    }

    /**
     * Pantalla previa al juego: pide al usuario que autorice a la app
     * third-party antes de entregarle su identidad dentro del iFrame.
     */
    private function consentScreen(Game $game, AccountRequirement $requirement): Response
    {
        $app = $game->registeredApp;
        $scopeCatalog = (array) config('vout.scopes', []);

        return Inertia::render('play/consent', [
            'game' => [
                'name' => $game->name,
                'slug' => $game->slug,
            ],
            // En un juego de cuenta opcional se ofrece jugar sin compartirla.
            'canPlayAsGuest' => $requirement->allowsGuests(),
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
