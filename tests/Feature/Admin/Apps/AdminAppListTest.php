<?php

use App\Models\RegisteredApp;
use App\Models\User;

it('requiere autenticación para acceder al listado', function (): void {
    $this->get(route('admin.apps.index'))
        ->assertRedirect(route('login'));
});

it('rechaza usuarios no admin con 403', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.apps.index'))
        ->assertForbidden();
});

it('muestra el listado de apps al admin', function (): void {
    $admin = User::factory()->admin()->create();
    RegisteredApp::factory()->count(3)->create();

    $this->actingAs($admin)
        ->get(route('admin.apps.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/apps/index')
            ->has('apps.data', 3)
        );
});

it('filtra apps activas', function (): void {
    $admin = User::factory()->admin()->create();
    RegisteredApp::factory()->count(2)->create(); // active by default
    RegisteredApp::factory()->inactive()->create();
    RegisteredApp::factory()->suspended()->create();

    $this->actingAs($admin)
        ->get(route('admin.apps.index', ['status' => 'active']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('apps.data', 2));
});

it('filtra apps pausadas', function (): void {
    $admin = User::factory()->admin()->create();
    RegisteredApp::factory()->create();
    RegisteredApp::factory()->inactive()->create();

    $this->actingAs($admin)
        ->get(route('admin.apps.index', ['status' => 'paused']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('apps.data', 1));
});

it('filtra apps suspendidas', function (): void {
    $admin = User::factory()->admin()->create();
    RegisteredApp::factory()->create();
    RegisteredApp::factory()->suspended()->create();

    $this->actingAs($admin)
        ->get(route('admin.apps.index', ['status' => 'suspended']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('apps.data', 1));
});

it('busca apps por nombre', function (): void {
    $admin = User::factory()->admin()->create();
    RegisteredApp::factory()->create(['name' => 'Dino Runner', 'slug' => 'dino-runner']);
    RegisteredApp::factory()->create(['name' => 'Space Invaders', 'slug' => 'space-invaders']);

    $this->actingAs($admin)
        ->get(route('admin.apps.index', ['search' => 'Dino']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('apps.data', 1));
});

it('busca apps por email del propietario', function (): void {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create(['email' => 'dev@example.com']);

    RegisteredApp::factory()->forUser($owner)->create();
    RegisteredApp::factory()->create();

    $this->actingAs($admin)
        ->get(route('admin.apps.index', ['search' => 'dev@example']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('apps.data', 1));
});

it('muestra la página show con detalles de la app', function (): void {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->create();

    $this->actingAs($admin)
        ->get(route('admin.apps.show', $app))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/apps/show')
            ->where('app.slug', $app->slug)
            ->where('app.owner.email', $owner->email)
        );
});
