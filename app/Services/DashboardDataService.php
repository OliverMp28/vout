<?php

namespace App\Services;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Calcula los datos del Dashboard Estratégico (Fase 2.5).
 *
 * Concentra la lógica del cockpit personal del usuario: continuidad
 * de juego, estadísticas rápidas, recomendaciones personalizadas,
 * contexto de ecosistema (dev/admin) y estado de onboarding.
 *
 * La clase es pura (sin side effects, sin writes): solo lee y
 * transforma. Las mutaciones (dismiss del hero) viven en el
 * controlador y modifican `UserSetting` directamente.
 */
class DashboardDataService
{
    /**
     * Cuántos minutos aproximados cuenta cada partida (heurística).
     *
     * Sin tracking real de duración, estimamos 5 minutos por partida
     * para dar una cifra significativa. Se recalibrará cuando haya
     * telemetría real de sesiones.
     */
    private const MINUTES_PER_PLAY = 5;

    /**
     * Último juego con `last_played_at` del usuario, o null si nunca jugó.
     *
     * Usa el scope existente `withUserInteraction` para evitar queries
     * adicionales al leer `best_score` y `last_played_at`.
     */
    public function continuePlaying(User $user): ?Game
    {
        return Game::query()
            ->active()
            ->withUserInteraction($user->id)
            ->whereRaw('user_pivot.last_played_at IS NOT NULL')
            ->with(['categories:id,name,slug'])
            ->orderByRaw('user_pivot.last_played_at DESC')
            ->first();
    }

    /**
     * Estadísticas agregadas para el widget "Quick Stats".
     *
     * - `gamesPlayed`: juegos distintos con `last_played_at NOT NULL`.
     * - `totalPlays`: suma de `play_count` del usuario.
     * - `topCategoryName`: nombre de la categoría con más play_count acumulado.
     * - `estimatedMinutes`: `totalPlays * MINUTES_PER_PLAY`, cap 9999.
     *
     * @return array{gamesPlayed: int, totalPlays: int, topCategoryName: ?string, estimatedMinutes: int}
     */
    public function quickStats(User $user): array
    {
        /** @var object{games_played: ?int, total_plays: ?int} $row */
        $row = DB::table('game_user')
            ->selectRaw('COUNT(CASE WHEN last_played_at IS NOT NULL THEN 1 END) AS games_played')
            ->selectRaw('COALESCE(SUM(play_count), 0) AS total_plays')
            ->where('user_id', $user->id)
            ->first() ?? (object) ['games_played' => 0, 'total_plays' => 0];

        $gamesPlayed = (int) ($row->games_played ?? 0);
        $totalPlays = (int) ($row->total_plays ?? 0);

        $topCategoryName = DB::table('game_user as gu')
            ->join('category_game as cg', 'cg.game_id', '=', 'gu.game_id')
            ->join('categories as c', 'c.id', '=', 'cg.category_id')
            ->where('gu.user_id', $user->id)
            ->where('gu.play_count', '>', 0)
            ->groupBy('c.id', 'c.name')
            ->orderByRaw('SUM(gu.play_count) DESC')
            ->value('c.name');

        return [
            'gamesPlayed' => $gamesPlayed,
            'totalPlays' => $totalPlays,
            'topCategoryName' => $topCategoryName !== null ? (string) $topCategoryName : null,
            'estimatedMinutes' => min($totalPlays * self::MINUTES_PER_PLAY, 9999),
        ];
    }

    /**
     * Juegos recomendados para el usuario.
     *
     * Estrategia:
     * 1. Top-N categorías por `play_count` del usuario.
     * 2. Juegos activos en esas categorías que el user NO haya jugado.
     * 3. Si el usuario no tiene histórico: fallback a `featured + popular`
     *    excluyendo juegos ya marcados como `is_favorite` o jugados.
     *
     * @return Collection<int, Game>
     */
    public function recommendations(User $user, int $limit = 4): Collection
    {
        $playedGameIds = DB::table('game_user')
            ->where('user_id', $user->id)
            ->whereNotNull('last_played_at')
            ->pluck('game_id')
            ->all();

        $topCategoryIds = DB::table('game_user as gu')
            ->join('category_game as cg', 'cg.game_id', '=', 'gu.game_id')
            ->where('gu.user_id', $user->id)
            ->where('gu.play_count', '>', 0)
            ->groupBy('cg.category_id')
            ->orderByRaw('SUM(gu.play_count) DESC')
            ->limit(3)
            ->pluck('cg.category_id')
            ->all();

        if ($topCategoryIds !== []) {
            $recommended = Game::query()
                ->active()
                ->published()
                ->whereHas('categories', fn ($q) => $q->whereIn('categories.id', $topCategoryIds))
                ->when($playedGameIds !== [], fn ($q) => $q->whereNotIn('games.id', $playedGameIds))
                ->with(['categories:id,name,slug'])
                ->sortedBy('popular')
                ->limit($limit)
                ->get();

            if ($recommended->isNotEmpty()) {
                return $recommended;
            }
        }

        return Game::query()
            ->active()
            ->published()
            ->when($playedGameIds !== [], fn ($q) => $q->whereNotIn('games.id', $playedGameIds))
            ->with(['categories:id,name,slug'])
            ->sortedBy('popular')
            ->limit($limit)
            ->get();
    }

    /**
     * Motivo traducible que acompaña a las recomendaciones.
     *
     * Devuelve la clave i18n y parámetros para que el frontend
     * haga la traducción. Null si no hay motivo específico (fallback).
     *
     * @return array{key: string, params: array<string, string>}|null
     */
    public function recommendationReason(User $user): ?array
    {
        $topCategory = DB::table('game_user as gu')
            ->join('category_game as cg', 'cg.game_id', '=', 'gu.game_id')
            ->join('categories as c', 'c.id', '=', 'cg.category_id')
            ->where('gu.user_id', $user->id)
            ->where('gu.play_count', '>', 0)
            ->groupBy('c.id', 'c.name')
            ->orderByRaw('SUM(gu.play_count) DESC')
            ->value('c.name');

        if ($topCategory === null) {
            return null;
        }

        return [
            'key' => 'dashboard.recommendations.because_category',
            'params' => ['category' => (string) $topCategory],
        ];
    }

    /**
     * ¿El usuario ha jugado al menos una vez?
     *
     * Usado para decidir si mostrar el hero de onboarding.
     */
    public function hasPlayedBefore(User $user): bool
    {
        return DB::table('game_user')
            ->where('user_id', $user->id)
            ->whereNotNull('last_played_at')
            ->exists();
    }

    /**
     * Contexto del ecosistema (roles y atajos contextuales).
     *
     * @return array{isDeveloper: bool, isAdmin: bool, developerAppsCount: ?int}
     */
    public function ecosystemContext(User $user): array
    {
        $appsCount = $user->registeredApps()->count();

        return [
            'isDeveloper' => $appsCount > 0,
            'isAdmin' => (bool) $user->is_admin,
            'developerAppsCount' => $appsCount > 0 ? $appsCount : null,
        ];
    }

    /**
     * Estado del hero de onboarding.
     *
     * - `show`: solo si el user no ha jugado y no ha descartado el hero.
     * - `steps`: tres pasos con flag `done` derivado del estado actual.
     *
     * @return array{show: bool, steps: list<array{key: string, done: bool}>}
     */
    public function onboardingState(User $user): array
    {
        $settings = $user->settings()->first();
        $dismissedAt = $settings?->dashboard_welcome_dismissed_at;

        $hasPlayed = $this->hasPlayedBefore($user);

        $exploredCatalog = $hasPlayed || DB::table('game_user')
            ->where('user_id', $user->id)
            ->exists();

        $hasGestures = $user->activeGestureConfig()->exists();

        $profileComplete = ($user->avatar !== null && $user->avatar !== '')
            || ($user->bio !== null && $user->bio !== '');

        return [
            'show' => ! $hasPlayed && $dismissedAt === null,
            'steps' => [
                ['key' => 'explore', 'done' => $exploredCatalog],
                ['key' => 'gestures', 'done' => $hasGestures],
                ['key' => 'profile', 'done' => $profileComplete],
            ],
        ];
    }
}
