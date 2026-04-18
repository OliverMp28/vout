<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Área de Privacidad — Fase 5.
 *
 * Agrupa los tres derechos RGPD que el portal expone al usuario autenticado:
 *   - Ver el estado de su consentimiento (versión aceptada, fecha, si hay
 *     re-prompt pendiente por cambio de versión de la Política).
 *   - Descargar todos sus datos en JSON (derecho de portabilidad, art. 20 RGPD).
 *   - Eliminar su cuenta (derecho de supresión, art. 17 RGPD) con copia
 *     explícita de qué se borra y qué se anonimiza.
 *
 * La eliminación vivía antes en `ProfileController::destroy`. Se traslada aquí
 * porque el encuadre legal y el copy son distintos: no es "borrar mi perfil",
 * es "ejercer derecho de supresión". Mantenemos `ProfileDeleteRequest` para
 * reutilizar la validación de contraseña actual.
 */
class PrivacyController extends Controller
{
    /**
     * Muestra el panel de privacidad.
     */
    public function show(Request $request): Response
    {
        $user = $request->user();

        $currentVersion = (string) config('vout.legal.current_privacy_version');
        $acceptedVersion = $user->privacy_version_accepted;

        return Inertia::render('settings/privacy', [
            'consent' => [
                'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                'privacy_version_accepted' => $acceptedVersion,
                'current_privacy_version' => $currentVersion,
                'needs_reacceptance' => $acceptedVersion !== null
                    && $acceptedVersion !== $currentVersion,
            ],
            'has_password' => ! empty($user->password),
        ]);
    }

    /**
     * Descarga un JSON con todos los datos del usuario (derecho de portabilidad).
     *
     * Se usa `streamDownload` para fijar el Content-Disposition sin que el
     * navegador intente navegar. El payload omite campos sensibles que jamás
     * deben exfiltrarse aunque el dueño los solicite: contraseña (hash),
     * secretos 2FA y remember_token. Esos datos no son "suyos" en el sentido
     * de portabilidad: son secretos operativos del sistema de autenticación.
     */
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user()->load([
            'settings',
            'gestureConfigs',
            'games',
            'registeredApps',
            'submittedGames',
            'developerProfile',
        ]);

        $payload = [
            'metadata' => [
                'exported_at' => now()->toIso8601String(),
                'privacy_version' => (string) config('vout.legal.current_privacy_version'),
                'vout_id' => $user->vout_id,
            ],
            'user' => [
                'vout_id' => $user->vout_id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'avatar' => $user->avatar,
                'bio' => $user->bio,
                'google_linked' => $user->google_id !== null,
                'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                'two_factor_enabled' => $user->two_factor_confirmed_at !== null,
                'is_admin' => (bool) $user->is_admin,
                'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                'privacy_version_accepted' => $user->privacy_version_accepted,
                'created_at' => $user->created_at?->toIso8601String(),
                'updated_at' => $user->updated_at?->toIso8601String(),
            ],
            'settings' => $user->settings?->only([
                'locale',
                'appearance',
                'show_mascot',
                'gestures_enabled',
                'dashboard_welcome_dismissed_at',
            ]),
            'gesture_configs' => $user->gestureConfigs->map(fn ($config) => [
                'profile_name' => $config->profile_name,
                'sensitivity' => $config->sensitivity,
                'gesture_mapping' => $config->gesture_mapping,
                'head_tracking_mode' => $config->head_tracking_mode,
                'is_active' => (bool) $config->is_active,
                'created_at' => $config->created_at?->toIso8601String(),
            ])->values(),
            'games_played' => $user->games->map(fn ($game) => [
                'game_slug' => $game->slug,
                'game_title' => $game->title,
                'is_favorite' => (bool) $game->pivot->is_favorite,
                'is_saved' => (bool) $game->pivot->is_saved,
                'play_count' => (int) $game->pivot->play_count,
                'best_score' => $game->pivot->best_score,
                'last_played_at' => $game->pivot->last_played_at,
            ])->values(),
            'registered_apps' => $user->registeredApps->map(fn ($app) => [
                'name' => $app->name,
                'slug' => $app->slug,
                'allowed_origins' => $app->allowed_origins,
                'redirect_uris' => $app->redirect_uris,
                'is_first_party' => (bool) $app->is_first_party,
                'created_at' => $app->created_at?->toIso8601String(),
            ])->values(),
            'submitted_games' => $user->submittedGames->map(fn ($game) => [
                'slug' => $game->slug,
                'title' => $game->title,
                'status' => $game->status,
                'submitted_at' => $game->created_at?->toIso8601String(),
            ])->values(),
            'developer_profile' => $user->developerProfile?->only([
                'name',
                'slug',
                'website',
                'email',
            ]),
        ];

        $filename = 'vout-mis-datos-'.now()->format('Y-m-d').'.json';

        return response()->streamDownload(
            function () use ($payload): void {
                echo json_encode(
                    $payload,
                    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                );
            },
            $filename,
            [
                'Content-Type' => 'application/json',
                'Cache-Control' => 'no-store, max-age=0',
            ],
        );
    }

    /**
     * Ejercicio del derecho de supresión (RGPD art. 17).
     *
     * El borrado es "duro" para los datos personales directos (el modelo User
     * se elimina y con él en cascada `user_settings`, `gesture_configs`,
     * `game_user`, `registered_apps`, `notifications`). Los juegos enviados
     * al catálogo (`games.submitted_by_user_id`) pasan a `null` por
     * `nullOnDelete`: quedan publicados pero sin autor visible, porque el
     * contenido del catálogo es de interés legítimo para el resto de usuarios.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
