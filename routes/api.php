<?php

use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Vout Ecosystem API Routes
|--------------------------------------------------------------------------
|
| Estas rutas son el punto de entrada para las aplicaciones del ecosistema
| que consumen la identidad de los usuarios mediante tokens OAuth2 (Passport).
|
| Todas las rutas están protegidas por el guard 'auth:api' y requieren
| un Bearer Token válido emitido por Vout a través del flujo OAuth2.
|
| Versionado:
|   - /api/v1/* → Versión actual y estable de la API.
|   - Futuras versiones se añadirán como /api/v2/* sin romper retrocompatibilidad.
|
| Documentación para integradores: docs/integration-guide.md
|
*/

Route::prefix('v1')->middleware('auth:api')->group(function () {

    // ── Identidad del Usuario ─────────────────────────────────────
    // Devuelve el perfil del usuario autenticado.
    // Scopes requeridos: user:read (base), user:email (opcional).
    Route::get('/user/me', [UserController::class, 'me'])
        ->name('api.v1.user.me');
});
