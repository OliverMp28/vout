<?php

// -----------------------------------------------------------------------
// El error de la contraseña desaparece en cuanto se corrige. Antes se
// quedaba el del intento anterior mientras el nuevo envío seguía en curso
// (en producción, esperando a la API de contraseñas filtradas) y parecía
// que la contraseña nueva tampoco valía.
// -----------------------------------------------------------------------

test('el error de la contraseña se borra al escribir otra', function () {
    $page = visit('/register');

    $page->type('#name', 'Oliver')
        ->type('#username', 'oliver')
        ->type('#email', 'oliver@example.com')
        ->type('#password', 'vout2026')
        ->type('#password_confirmation', 'vout2027')
        ->click('#accept_terms')
        ->click('[data-test="register-user-button"]')
        ->assertPresent('#password ~ p.text-danger-text');

    $page->type('#password', 'vout2027')
        ->assertNotPresent('#password ~ p.text-danger-text')
        ->assertNoJavaScriptErrors();
});
