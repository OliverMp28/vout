<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\EnsureEmailIsVerified;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exige email confirmado para autorizar apps con Vout.
 *
 * Passport registra sus rutas por su cuenta y su opción de middleware se
 * aplica también a `/oauth/token`, que llega sin usuario: por eso este
 * filtro va en el grupo `web` y solo actúa sobre las pantallas donde una
 * persona autoriza una app. Sin él, una cuenta sin confirmar podía entregar
 * a terceros un email que nadie había demostrado poseer.
 *
 * Delega en el `verified` de Laravel: redirige a la pantalla de
 * confirmación guardando la URL, así que tras confirmar el usuario vuelve
 * a la autorización que tenía a medias.
 */
class EnsureEmailIsVerifiedForOAuth
{
    /**
     * Rutas de Passport en las que el usuario autoriza una app.
     *
     * @var list<string>
     */
    private const array AUTHORIZATION_ROUTES = [
        'passport.authorizations.*',
        'passport.device',
        'passport.device.authorizations.*',
    ];

    public function __construct(private EnsureEmailIsVerified $ensureEmailIsVerified) {}

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() === null || ! $request->routeIs(...self::AUTHORIZATION_ROUTES)) {
            return $next($request);
        }

        return $this->ensureEmailIsVerified->handle($request, $next);
    }
}
