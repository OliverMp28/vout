<?php

use App\Http\Controllers\Catalog\FavoriteController;
use App\Http\Controllers\Catalog\GameController;
use App\Http\Controllers\Catalog\SavedController;
use App\Http\Controllers\Catalog\UserLibraryController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas del Catálogo de Juegos
|--------------------------------------------------------------------------
|
| Acceso público para browsing (guests + autenticados).
| Las acciones sobre juegos (favoritos, guardados) requieren autenticación.
|
*/

// Rutas públicas — accesibles sin login
Route::get('/catalog', [GameController::class, 'index'])->name('catalog.index');
Route::get('/catalog/{game}', [GameController::class, 'show'])->name('catalog.show');

// Rutas protegidas — requieren autenticación
Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('/catalog/{game}/favorite', [FavoriteController::class, 'toggle'])->name('catalog.favorite.toggle');
    Route::post('/catalog/{game}/saved', [SavedController::class, 'toggle'])->name('catalog.saved.toggle');

    Route::get('/library/favorites', [UserLibraryController::class, 'favorites'])->name('library.favorites');
    Route::get('/library/saved', [UserLibraryController::class, 'saved'])->name('library.saved');
});
