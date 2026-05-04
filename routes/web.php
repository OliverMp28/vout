<?php

use App\Http\Controllers\Auth\SocialiteCompleteController;
use App\Http\Controllers\Auth\SocialiteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\LegalController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\OAuth\JwksController;
use App\Http\Controllers\OAuth\OidcDiscoveryController;
use App\Http\Controllers\PlayController;
use App\Http\Controllers\VisionLabController;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

Route::get('/', [HomeController::class, 'index'])->name('home');

// ── OAuth2 / OIDC Discovery (públicos, sin estado) ─────────────────────
// Endpoints que necesitan los Resource Servers para auto-configurarse y
// validar firmas de JWT localmente sin consultar la BD de Vout.
//
//   /.well-known/openid-configuration → metadatos del IdP (RFC 8414/OIDC).
//   /oauth/jwks                       → claves públicas (RFC 7517).
//
// Se les retira la pila de sesión/cookies completa porque:
//   1. son JSON públicos sin estado de usuario,
//   2. el `Cache-Control: public, max-age=3600` permite cacheo en CDN
//      y proxies — si dejásemos `Set-Cookie: vout-session=...` en la
//      respuesta, un CDN mal configurado podría servir la misma sesión
//      a todos los visitantes (session fixation),
//   3. también se quita el stack de Inertia/Appearance/SetLocale por
//      pura eficiencia: nada de eso aplica a un consumidor de JWKS.
//
// Las dependencias entre middlewares de sesión exigen que se quiten
// todas a la vez (ShareErrorsFromSession asume que StartSession ya
// corrió, etc.) — quitar solo una rompe el pipeline.
$oauthPublicMiddlewareSkip = [
    EncryptCookies::class,
    AddQueuedCookiesToResponse::class,
    StartSession::class,
    ShareErrorsFromSession::class,
    PreventRequestForgery::class,
    HandleAppearance::class,
    HandleInertiaRequests::class,
    SetLocale::class,
];

Route::get('.well-known/openid-configuration', OidcDiscoveryController::class)
    ->name('oauth.discovery')
    ->withoutMiddleware($oauthPublicMiddlewareSkip);

Route::get('oauth/jwks', JwksController::class)
    ->name('oauth.jwks')
    ->withoutMiddleware($oauthPublicMiddlewareSkip);

// Fase 5 — Páginas legales públicas.
// El `where` bloquea path traversal: sólo [a-z0-9-]+ llega al controlador.
Route::get('legal/{slug}', [LegalController::class, 'show'])
    ->where('slug', '[a-z0-9-]+')
    ->name('legal.show');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    // Fase 2.5 — Descarta el hero de onboarding del dashboard.
    Route::post('dashboard/welcome/dismiss', [DashboardController::class, 'dismissWelcome'])
        ->name('dashboard.welcome.dismiss');

    // Fase 3.3 — Reproductor de juegos embebidos.
    // Requiere autenticación verificada porque genera un token de identidad.
    Route::get('play/{game}', [PlayController::class, 'show'])->name('play.show');
});

Route::middleware('guest')->group(function () {
    Route::get('auth/google/redirect', [SocialiteController::class, 'redirect'])->name('auth.google.redirect');
    Route::get('auth/google/callback', [SocialiteController::class, 'callback'])->name('auth.google.callback');
});

// Fase 5 — Interstitial de consentimiento tras primer login con Google.
// Requiere usuario autenticado (recién creado por SocialiteController). Si ya
// aceptó las políticas, el controlador redirige al dashboard automáticamente.
Route::middleware('auth')->group(function () {
    Route::get('auth/google/complete', [SocialiteCompleteController::class, 'show'])->name('auth.google.complete');
    Route::post('auth/google/complete', [SocialiteCompleteController::class, 'store'])->name('auth.google.complete.store');
    Route::post('auth/google/cancel', [SocialiteCompleteController::class, 'cancel'])->name('auth.google.cancel');
});

Route::post('/locale', [LocaleController::class, 'update'])->name('locale.update');

if (app()->environment('local')) {
    Route::get('vision-lab', VisionLabController::class)
        ->middleware('auth')
        ->name('vision-lab');
}

require __DIR__.'/settings.php';
require __DIR__.'/catalog.php';
require __DIR__.'/developers.php';
