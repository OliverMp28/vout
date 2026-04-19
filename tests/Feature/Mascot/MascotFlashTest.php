<?php

use App\Models\User;

// -----------------------------------------------------------------------
// S6 — Vou es la superficie unificada de notificaciones. Este test
// protege el contrato Inertia `flash.{status,error}` que el provider de
// React observa para disparar `notify()` + `celebrate()`. Si estas
// props dejaran de compartirse, la mascota se quedaría muda ante los
// mensajes flash del backend (admin/developer/auth controllers).
// -----------------------------------------------------------------------

test('la prop flash.status se comparte cuando hay un mensaje de éxito en sesión', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['status' => 'test.success.key'])
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('flash.status', 'test.success.key')
            ->where('flash.error', null)
        );
});

test('la prop flash.error se comparte cuando hay un error en sesión', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['error' => 'Algo salió mal.'])
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('flash.error', 'Algo salió mal.')
            ->where('flash.status', null)
        );
});

test('sin flash en sesión ambas props quedan en null', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('flash.status', null)
            ->where('flash.error', null)
        );
});
