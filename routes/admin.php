<?php

use App\Http\Controllers\Admin\AdminAppController;
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
