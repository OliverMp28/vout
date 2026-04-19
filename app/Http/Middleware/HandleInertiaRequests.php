<?php

namespace App\Http\Middleware;

use App\Enums\GameStatus;
use App\Models\Game;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'username' => $request->user()->username,
                    'bio' => $request->user()->bio,
                    'avatar' => $request->user()->avatar,
                    'vout_id' => $request->user()->vout_id,
                    'google_id' => $request->user()->google_id,
                    'has_password' => ! empty($request->user()->getAuthPassword()),
                    'email_verified_at' => $request->user()->email_verified_at,
                    'is_admin' => (bool) $request->user()->is_admin,
                    'settings' => $request->user()->settings,
                ] : null,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'admin' => $this->adminContext($request),
            'flash' => [
                'status' => $request->session()->get('status'),
                'error' => $request->session()->get('error'),
            ],
            'locale' => app()->getLocale(),
            'translations' => file_exists(base_path('lang/'.app()->getLocale().'.json'))
                ? json_decode(file_get_contents(base_path('lang/'.app()->getLocale().'.json')), true)
                : [],
        ];
    }

    /**
     * Contexto compartido sólo para páginas del panel admin — expone un
     * contador ligero para la insignia "pendientes de revisión" del
     * sub-nav. Se calcula únicamente cuando el usuario es admin y la
     * ruta pertenece al grupo `admin.*`, para no pagar la query en el
     * resto del portal.
     *
     * @return array<string, mixed>|null
     */
    private function adminContext(Request $request): ?array
    {
        $user = $request->user();

        if (! $user?->is_admin || ! $request->routeIs('admin.*')) {
            return null;
        }

        return [
            'pendingGamesCount' => Game::query()
                ->where('status', GameStatus::PendingReview->value)
                ->count(),
        ];
    }
}
