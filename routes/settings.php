<?php

use App\Http\Controllers\Auth\SocialiteController;
use App\Http\Controllers\Settings\AppearanceController;
use App\Http\Controllers\Settings\GestureConfigController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\PrivacyController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use App\Http\Controllers\Settings\UserSettingController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'verified'])->group(function () {
    // Fase 5 — Privacidad (derechos RGPD).
    // El borrado de cuenta vive aquí (antes en /settings/profile) porque el
    // encuadre legal y la UX son distintos al flujo genérico de perfil.
    Route::get('settings/privacy', [PrivacyController::class, 'show'])->name('privacy.edit');
    Route::get('settings/privacy/export', [PrivacyController::class, 'export'])
        ->middleware('throttle:6,1')
        ->name('privacy.export');
    Route::delete('settings/privacy', [PrivacyController::class, 'destroy'])->name('privacy.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('user-password.edit');

    Route::put('settings/password', [PasswordController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::get('settings/appearance', [AppearanceController::class, 'edit'])->name('appearance.edit');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');

    Route::patch('settings/appearance', [UserSettingController::class, 'update'])->name('user-settings.update');

    Route::delete('settings/google', [SocialiteController::class, 'unlink'])->name('google.unlink');

    Route::post('gesture-configs', [GestureConfigController::class, 'store'])->name('gesture-configs.store');
    Route::put('gesture-configs/{gestureConfig}', [GestureConfigController::class, 'update'])->name('gesture-configs.update');
    Route::delete('gesture-configs/{gestureConfig}', [GestureConfigController::class, 'destroy'])->name('gesture-configs.destroy');
});
