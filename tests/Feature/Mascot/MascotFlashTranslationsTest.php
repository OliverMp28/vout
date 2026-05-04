<?php

/*
 * Vou habla por flash messages. El backend manda claves crudas vía
 * `->with('status', 'foo.bar.baz')` y el provider React las traduce con
 * `t()`. Si la clave no existe en `lang/{es,en}.json`, la mascota la
 * suelta literal — feo y rompe la inmersión.
 *
 * Este test garantiza que cada flash key emitida por un controller tiene
 * traducción en ambos locales. Cuando añadas un nuevo `with('status', ...)`,
 * añade aquí la key — el test te recuerda traducirla.
 */

dataset('flash_status_keys', [
    // Developer Portal
    'developers.apps.created',
    'developers.apps.updated',
    'developers.apps.deleted',
    'developers.apps.activated',
    'developers.apps.paused',
    'developers.profile.created',
    'developers.profile.updated',
    'developers.games.submitted',
    'developers.games.updated',
    'developers.games.deleted',

    // Admin
    'admin.games.approved',
    'admin.games.rejected',
    'admin.games.featured_toggled',
    'admin.games.updated',
    'admin.games.destroyed',
    'admin.apps.first_party_toggled',
    'admin.apps.suspended',
    'admin.apps.reactivated',
    'admin.apps.destroyed',
    'admin.developers.created',
    'admin.developers.updated',
    'admin.developers.destroyed',
    'admin.categories.created',
    'admin.categories.updated',
    'admin.categories.destroyed',

    // Auth
    'google-unlinked',
]);

it('la flash key tiene traducción en español', function (string $key): void {
    $es = json_decode(file_get_contents(base_path('lang/es.json')), true);

    expect($es)->toHaveKey($key)
        ->and($es[$key])->toBeString()->not->toBe('')->not->toBe($key);
})->with('flash_status_keys');

it('la flash key tiene traducción en inglés', function (string $key): void {
    $en = json_decode(file_get_contents(base_path('lang/en.json')), true);

    expect($en)->toHaveKey($key)
        ->and($en[$key])->toBeString()->not->toBe('')->not->toBe($key);
})->with('flash_status_keys');
