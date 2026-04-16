<?php

use App\Http\Controllers\Admin\AdminAppController;
use App\Http\Controllers\Admin\AdminGameController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas del Panel de Administración (Fase 4.2)
|--------------------------------------------------------------------------
|
| Protegidas por los middleware `auth`, `verified` y `admin`.
| Prefix `/admin`, name prefix `admin.`.
|
*/

Route::redirect('/', '/admin/games');

// ── Apps ────────────────────────────────────────────────────────────────
Route::get('apps', [AdminAppController::class, 'index'])
    ->name('apps.index');
Route::get('apps/{app}', [AdminAppController::class, 'show'])
    ->name('apps.show');
Route::post('apps/{app}/first-party', [AdminAppController::class, 'toggleFirstParty'])
    ->name('apps.first-party');
Route::post('apps/{app}/suspend', [AdminAppController::class, 'suspend'])
    ->name('apps.suspend');
Route::post('apps/{app}/reactivate', [AdminAppController::class, 'reactivate'])
    ->name('apps.reactivate');
Route::delete('apps/{app}', [AdminAppController::class, 'destroy'])
    ->name('apps.destroy');

// ── Games ──────────────────────────────────────────────────────────────
Route::get('games', [AdminGameController::class, 'index'])
    ->name('games.index');
Route::get('games/{game:slug}', [AdminGameController::class, 'show'])
    ->name('games.show');
Route::post('games/{game:slug}/approve', [AdminGameController::class, 'approve'])
    ->name('games.approve');
Route::post('games/{game:slug}/reject', [AdminGameController::class, 'reject'])
    ->name('games.reject');
Route::post('games/{game:slug}/featured', [AdminGameController::class, 'toggleFeatured'])
    ->name('games.featured');
Route::put('games/{game:slug}', [AdminGameController::class, 'update'])
    ->name('games.update');
Route::delete('games/{game:slug}', [AdminGameController::class, 'destroy'])
    ->name('games.destroy');
