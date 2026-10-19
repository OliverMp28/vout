<?php

use Inertia\Testing\AssertableInertia as Assert;

/*
 * El frontend manda el token en `X-CSRF-TOKEN` (ver `resources/js/lib/csrf.ts`)
 * en vez de leer la cookie `XSRF-TOKEN`, que en `.vout.tech` puede ser de otra
 * app. El token sale del `<meta name="csrf-token">` en la carga inicial y de
 * la prop compartida `csrfToken` en cada respuesta de Inertia.
 */

it('expone el token CSRF en el meta del layout y como prop compartida', function (): void {
    $response = $this->get(route('login'));

    $token = session()->token();

    $response->assertOk()
        ->assertSee('<meta name="csrf-token" content="'.$token.'">', false)
        ->assertInertia(fn (Assert $page) => $page->where('csrfToken', $token));
});
