<?php

use App\Models\User;
use App\Models\UserSetting;

// -----------------------------------------------------------------------
// Ajustes en el idioma del portal: el perfil y la contraseña venían del kit
// de inicio con textos fijos en inglés y el campo de archivo nativo (que
// habla el idioma del navegador, no el del portal).
// -----------------------------------------------------------------------

function actingAsSettingsUser(): User
{
    $user = User::factory()->create(['name' => 'Oliver Prueba']);
    UserSetting::factory()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    test()->actingAs($user);

    return $user;
}

test('el perfil está en español y la foto se elige con un botón propio', function () {
    actingAsSettingsUser();

    visit('/settings/profile')
        ->assertNoJavaScriptErrors()
        ->assertSee('Elegir imagen')
        ->assertSee('Cuenta de Google')
        ->assertSee('Sin conectar')
        ->assertDontSee('Google Linked Account')
        ->assertDontSee('Not Connected')
        ->assertPresent('input#avatar[type="file"][name="avatar"]');
});

test('al elegir una foto se ve antes de guardar', function () {
    actingAsSettingsUser();

    $page = visit('/settings/profile');

    // Como si el usuario eligiera un archivo (el navegador de test corre en
    // otro equipo y no puede leer rutas locales).
    $page->script(<<<'JS'
        const input = document.querySelector('#avatar');
        const files = new DataTransfer();
        files.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'foto.svg', { type: 'image/svg+xml' }));
        input.files = files.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    JS);

    $page->assertSee('foto.svg')
        ->assertPresent('img[src^="blob:"]')
        ->assertNoJavaScriptErrors();
});

test('la contraseña está en español', function () {
    actingAsSettingsUser();

    visit('/settings/password')
        ->assertNoJavaScriptErrors()
        ->assertSee('Contraseña actual')
        ->assertSee('Guardar contraseña')
        ->assertDontSee('Current password')
        ->assertDontSee('Save password');
});
