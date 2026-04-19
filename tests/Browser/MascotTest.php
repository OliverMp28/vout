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

test('Vou SÍ aparece en /settings/profile para que el celebrate al guardar sea visible (S6)', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => true]);

    $this->actingAs($user);

    $page = visit('/settings/profile');

    // A diferencia de /settings/appearance (que tiene VouPreview estático),
    // el resto de tabs de settings montan la mascota para que el
    // feedback de `CelebrateOnSuccess` (notify + celebrate) sea visible.
    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot');
});

test('al guardar perfil, Vou muestra el tooltip de notificación en tono success (S6)', function () {
    $user = User::factory()->create([
        'name' => 'Original Name',
    ]);
    UserSetting::factory()->for($user)->create(['show_mascot' => true]);

    $this->actingAs($user);

    $page = visit('/settings/profile');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->fill('input[name="name"]', 'Nuevo Nombre Vou')
        ->click('[data-test="update-profile-button"]');

    // Tras el patch exitoso, `recentlySuccessful` pasa a true y
    // `CelebrateOnSuccess` dispara `notify(t('settings.saved'), 'success')`.
    // El tooltip expone `data-tone="success"` cuando está en ese modo, y
    // se vuelve visible (opacity 100) mientras haya mensaje activo. Un
    // `assertVisible` con ese selector es más robusto que grep de texto
    // porque no depende del locale y auto-espera al cambio de estado.
    $page->assertVisible('.vou-mascot [data-tone="success"]');
});
