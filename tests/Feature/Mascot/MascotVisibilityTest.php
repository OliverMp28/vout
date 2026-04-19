<?php

use App\Models\User;
use App\Models\UserSetting;

// -----------------------------------------------------------------------
// Propósito: la mascota es puramente cliente (React), pero su render está
// condicionado por `auth.user.settings.show_mascot`, un prop compartido
// desde `HandleInertiaRequests`. Si ese prop dejara de viajar, MascotRoot
// quedaría en oscuro — estos tests protegen ese contrato.
// -----------------------------------------------------------------------

test('dashboard expone show_mascot=true cuando el usuario lo tiene activado', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => true]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('auth.user.settings.show_mascot', true)
        );
});

test('dashboard expone show_mascot=false cuando el usuario lo tiene desactivado', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => false]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('auth.user.settings.show_mascot', false)
        );
});

test('dashboard expone settings=null si el usuario aún no tiene fila en user_settings', function () {
    // Caso real: usuarios legacy creados antes de la migración de settings
    // o factories sin el state explícito. MascotRoot debe tratarlo como
    // "no mostrar" (ver el `?? false` en el componente).
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('auth.user.settings', null)
        );
});

test('welcome público no expone usuario y por tanto la mascota nunca se monta', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('auth.user', null)
        );
});
