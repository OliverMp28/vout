<?php

use App\Http\Controllers\Auth\SocialiteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\PlayController;
use App\Http\Controllers\VisionLabController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

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

Route::post('/locale', [LocaleController::class, 'update'])->name('locale.update');

if (app()->environment('local')) {
    Route::get('vision-lab', VisionLabController::class)
        ->middleware('auth')
        ->name('vision-lab');
}

require __DIR__.'/settings.php';
require __DIR__.'/catalog.php';
require __DIR__.'/developers.php';
