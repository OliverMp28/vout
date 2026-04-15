<?php

use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

// Las vistas Inertia (`developers/landing`, `developers/docs`, `developers/dashboard/*`)
// se construyen en S2-S4. Por eso usamos `component(name, false)` para saltarnos
// la verificación de existencia del archivo .tsx y validar solo el contrato backend.

it('sirve la landing de developers sin autenticación', function (): void {
    get(route('developers.landing'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('developers/landing', false)
            ->has('guides', 2)
            ->where('is_authenticated', false));
});

it('marca is_authenticated true para usuarios logueados en la landing', function (): void {
    actingAs(User::factory()->create())
        ->get(route('developers.landing'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('is_authenticated', true));
});

it('redirige al login si un invitado abre el dashboard', function (): void {
    get(route('developers.dashboard'))->assertRedirect(route('login'));
});
