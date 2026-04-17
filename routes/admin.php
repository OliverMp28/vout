<?php

use App\Http\Controllers\Admin\AdminAppController;
use App\Http\Controllers\Admin\AdminCategoryController;
use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\AdminDeveloperController;
use App\Http\Controllers\Admin\AdminGameController;
use App\Http\Controllers\Admin\AuditLogController;
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

Route::redirect('/', '/admin/dashboard');

// ── Dashboard ───────────────────────────────────────────────────────────
Route::get('dashboard', AdminDashboardController::class)
    ->name('dashboard');

// ── Audit Log ──────────────────────────────────────────────────────────
Route::get('audit', [AuditLogController::class, 'index'])
    ->name('audit.index');

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

// ── Categories ────────────────────────────────────────────────────────
Route::get('categories', [AdminCategoryController::class, 'index'])
    ->name('categories.index');
Route::get('categories/create', [AdminCategoryController::class, 'create'])
    ->name('categories.create');
Route::post('categories', [AdminCategoryController::class, 'store'])
    ->name('categories.store');
Route::get('categories/{category:slug}/edit', [AdminCategoryController::class, 'edit'])
    ->name('categories.edit');
Route::put('categories/{category:slug}', [AdminCategoryController::class, 'update'])
    ->name('categories.update');
Route::delete('categories/{category:slug}', [AdminCategoryController::class, 'destroy'])
    ->name('categories.destroy');

// ── Developers ────────────────────────────────────────────────────────
Route::get('developers', [AdminDeveloperController::class, 'index'])
    ->name('developers.index');
Route::get('developers/create', [AdminDeveloperController::class, 'create'])
    ->name('developers.create');
Route::post('developers', [AdminDeveloperController::class, 'store'])
    ->name('developers.store');
Route::get('developers/{developer:slug}/edit', [AdminDeveloperController::class, 'edit'])
    ->name('developers.edit');
Route::put('developers/{developer:slug}', [AdminDeveloperController::class, 'update'])
    ->name('developers.update');
Route::post('developers/{developer:slug}/reassign', [AdminDeveloperController::class, 'reassign'])
    ->name('developers.reassign');
Route::delete('developers/{developer:slug}', [AdminDeveloperController::class, 'destroy'])
    ->name('developers.destroy');
