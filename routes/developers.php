<?php

use App\Http\Controllers\Developers\DeveloperAppController;
use App\Http\Controllers\Developers\DevelopersLandingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas del Developer Portal (Fase 4.1)
|--------------------------------------------------------------------------
|
| Divide la superficie en dos zonas:
|
|  1. Público: landing y visor de documentación. Convence al desarrollador
|     externo antes de pedir autenticación.
|  2. Protegido (auth + verified): dashboard autoservicio para registrar
|     aplicaciones del ecosistema y gestionar credenciales OAuth.
|
*/

// ── Zona pública ────────────────────────────────────────────────────────
Route::get('developers', [DevelopersLandingController::class, 'show'])
    ->name('developers.landing');

Route::get('developers/docs/{slug}', [DevelopersLandingController::class, 'docs'])
    ->where('slug', '[a-z0-9-]+')
    ->name('developers.docs');

// ── Zona protegida (dashboard + CRUD apps) ──────────────────────────────
Route::middleware(['auth', 'verified'])
    ->prefix('developers')
    ->name('developers.')
    ->group(function (): void {
        Route::get('dashboard', [DeveloperAppController::class, 'index'])
            ->name('dashboard');

        Route::get('apps/create', [DeveloperAppController::class, 'create'])
            ->name('apps.create');
        Route::post('apps', [DeveloperAppController::class, 'store'])
            ->name('apps.store');
        Route::get('apps/{app:slug}', [DeveloperAppController::class, 'show'])
            ->name('apps.show');
        Route::put('apps/{app:slug}', [DeveloperAppController::class, 'update'])
            ->name('apps.update');
        Route::post('apps/{app:slug}/secret', [DeveloperAppController::class, 'regenerateSecret'])
            ->name('apps.secret');
        Route::post('apps/{app:slug}/toggle', [DeveloperAppController::class, 'toggleActive'])
            ->name('apps.toggle');
        Route::delete('apps/{app:slug}', [DeveloperAppController::class, 'destroy'])
            ->name('apps.destroy');
    });
