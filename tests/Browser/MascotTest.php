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

// -----------------------------------------------------------------------
// S7 — Mensajes contextuales por ruta.
//
// Vou deja de saludar "en abstracto" y habla del contexto real de la
// página. Las páginas registran candidatos vía `useMascotContext()`;
// al hacer tap, el provider elige el activo de mayor prioridad o hace
// fallback a un saludo aleatorio si ninguno aplica.
// -----------------------------------------------------------------------

test('tap en Vou en /library/favorites vacío muestra el mensaje contextual de empty state (S7)', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => true]);

    $this->actingAs($user);

    $page = visit('/library/favorites');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->click('.vou-button');

    // Aceptamos ES y EN porque el locale depende del UserSetting factory.
    $body = $page->content();
    expect($body)->toMatch(
        '/Aún no tienes favoritos|No favorites yet/u'
    );
});

test('tap en Vou en /library/saved vacío muestra el mensaje contextual de empty state (S7)', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => true]);

    $this->actingAs($user);

    $page = visit('/library/saved');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->click('.vou-button');

    $body = $page->content();
    expect($body)->toMatch(
        '/No has guardado nada|Nothing saved yet/u'
    );
});

test('tap en Vou en /dashboard inserta el nombre del usuario en el saludo horario (S7)', function () {
    // Usuario con nombre fijo y muy identificable para evitar falsos
    // positivos con fragmentos del layout (breadcrumbs, header, etc.).
    $user = User::factory()->create(['name' => 'VouTestUserZX']);
    // Descarta el onboarding para que sólo quede activo el saludo horario
    // (priority 10) en el dashboard — el onboarding tendría priority 20 y
    // ganaría al tap.
    UserSetting::factory()->for($user)->create([
        'show_mascot' => true,
        'dashboard_welcome_dismissed_at' => now(),
    ]);

    $this->actingAs($user);

    $page = visit('/dashboard');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->click('.vou-button');

    // El saludo horario siempre está activo (prioridad 10); mete el nombre
    // del usuario vía :name. Solo miramos el tooltip de la mascota para
    // no confundirnos con el header. Los saludos genéricos (mascot.greetings.*)
    // NO contienen el nombre — si lo vemos, es prueba de que el sistema
    // contextual tomó prioridad sobre el fallback aleatorio.
    $body = $page->content();
    expect($body)->toMatch('/Buen[oa]s?\s\w+,\sVouTestUserZX|Good\s\w+,\sVouTestUserZX/u');
});

// -----------------------------------------------------------------------
// S7+ — Auto-show proactivo.
//
// Algunos candidatos se declaran con `auto: true` para que Vou los muestre
// proactivamente al entrar en la ruta, sin que el usuario tenga que hacer
// tab+enter o click. El provider aplica throttle global y dedup por
// id|texto para no spamear al usuario.
// -----------------------------------------------------------------------

test('en /library/favorites vacío, Vou auto-muestra el mensaje sin necesidad de tap (S7 auto)', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create([
        'show_mascot' => true,
        'locale' => 'es',
    ]);

    $this->actingAs($user);

    $page = visit('/library/favorites');

    // Auto-show tiene un retardo interno de ~1.2s desde el cambio de
    // ruta. Esperamos un poco más para dar margen al efecto + fade-in.
    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->wait(2);

    // Sin hacer click: el tooltip debe estar mostrando el mensaje ES del
    // empty state.
    $page->assertSee('Aún no tienes favoritos');
});

test('en /settings/password el tip no se auto-muestra (es tap-only) (S7 auto)', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create([
        'show_mascot' => true,
        'locale' => 'es',
    ]);

    $this->actingAs($user);

    $page = visit('/settings/password');

    // Damos margen suficiente para que, si hubiera auto-show mal marcado,
    // se dispare dentro de este tiempo.
    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->wait(2);

    // El candidato de /settings/password NO es `auto: true` — no debe
    // verse sin interacción.
    $page->assertDontSee('Elige algo largo y único');

    // Tras el click sí aparece (comportamiento de tap estándar).
    $page->click('.vou-button')
        ->assertSee('Elige algo largo y único');
});

// -----------------------------------------------------------------------
// S8 — Onboarding guiado por Vou.
//
// Cuando el dashboard expone `onboarding.show=true` con pasos pendientes,
// Vou entra en modo `guide`: tooltip anclado apuntando al primer paso
// pendiente y badge de progreso "n/total". El tooltip se queda visible
// sin necesidad de tap, en contraposición al auto-show temporal de S7.
// -----------------------------------------------------------------------

test('en /dashboard con onboarding pendiente, Vou entra en modo guide con tooltip anclado (S8)', function () {
    // Usuario recién creado: no ha jugado, no ha descartado el hero, no
    // tiene avatar ni bio ni gesture config → tres pasos pendientes.
    $user = User::factory()->create([
        'name' => 'GuideUser',
        'avatar' => null,
        'bio' => null,
    ]);
    UserSetting::factory()->for($user)->create([
        'show_mascot' => true,
        'locale' => 'es',
        'dashboard_welcome_dismissed_at' => null,
    ]);

    $this->actingAs($user);

    $page = visit('/dashboard');

    // La sincronización onboarding → guide() corre en un useEffect tras
    // montar el dashboard. Margen para que el tooltip anclado aparezca.
    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->wait(2);

    // Tooltip visible sin tap, con la variante "guide" y el badge de
    // progreso 1/3 (explore es el primer paso pendiente).
    $page->assertVisible('.vou-mascot [data-variant="guide"]')
        ->assertVisible('[data-test="mascot-guide-progress"]')
        ->assertSee('1/3')
        ->assertSee('Empecemos');
});

test('en /dashboard con onboarding descartado, Vou NO entra en modo guide (S8)', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create([
        'show_mascot' => true,
        'locale' => 'es',
        // Hero descartado → onboarding.show=false → guide no se activa.
        'dashboard_welcome_dismissed_at' => now(),
    ]);

    $this->actingAs($user);

    $page = visit('/dashboard');

    $page->assertNoJavaScriptErrors()
        ->assertVisible('.vou-mascot')
        ->wait(2);

    // Sin modo guide: el tooltip nunca debe exponer variante guide ni badge.
    $page->assertMissing('.vou-mascot [data-variant="guide"]')
        ->assertMissing('[data-test="mascot-guide-progress"]');
});

test('OnboardingHero resalta el paso actual al que apunta Vou (S8)', function () {
    $user = User::factory()->create(['avatar' => null, 'bio' => null]);
    UserSetting::factory()->for($user)->create([
        'show_mascot' => true,
        'locale' => 'es',
        'dashboard_welcome_dismissed_at' => null,
    ]);

    $this->actingAs($user);

    $page = visit('/dashboard');

    // El primer paso pendiente ("explore") debe llevar `data-current`.
    // Coincide con el paso que Vou narra en su tooltip.
    $page->assertNoJavaScriptErrors()
        ->assertVisible('[data-current="true"]');
});
