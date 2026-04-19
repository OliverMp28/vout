<?php

use App\Models\User;
use App\Models\UserSetting;

// -----------------------------------------------------------------------
// Tests de navegador reales para la mascota Vou. Complementan los tests
// de Feature (MascotVisibilityTest) que sólo validan la prop Inertia:
// aquí ejecutamos el frontend en Chromium y verificamos el render + la
// interacción efectiva (click → saludo).
// -----------------------------------------------------------------------

test('Vou aparece en el dashboard cuando show_mascot=true y reacciona al click', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => true]);

    $this->actingAs($user);

    $page = visit('/dashboard');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->click('.vou-button');

    // Tras el TAP, el tooltip muestra uno de los tres saludos i18n.
    // No podemos predecir cuál (el mensaje es aleatorio) ni el locale
    // (depende del UserSetting factory), así que aceptamos los 6 posibles.
    $body = $page->content();

    expect($body)->toMatch(
        '/¡Hola!|¿Listo para jugar\?|Estoy aquí si me necesitas\.|Hi!|Ready to play\?|I&#039;m here if you need me\./u'
    );
});

test('Vou no se monta en el dashboard cuando show_mascot=false', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => false]);

    $this->actingAs($user);

    $page = visit('/dashboard');

    $page->assertNoJavaScriptErrors()
        ->assertMissing('.vou-mascot');
});

test('Vou está excluido de /settings/appearance aunque show_mascot=true', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => true]);

    $this->actingAs($user);

    $page = visit('/settings/appearance');

    // La página de settings ya muestra su propio VouPreview (estático),
    // pero la mascota interactiva del portal no debe aparecer allí.
    $page->assertNoJavaScriptErrors()
        ->assertMissing('.vou-mascot');
});
