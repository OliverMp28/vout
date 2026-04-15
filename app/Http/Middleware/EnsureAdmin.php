<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware de protección del Panel de Administración interno (Fase 4.2).
 *
 * Aplica encima de `auth` y `verified`: cuando llega aquí el usuario ya está
 * autenticado y verificado. Solo queda comprobar la marca `is_admin = true`.
 *
 * Cualquier otro caso aborta con 403 (no redirige al login para no filtrar
 * la existencia de la zona admin a usuarios sin privilegio).
 */
class EnsureAdmin
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_admin) {
            abort(403);
        }

        return $next($request);
    }
}
