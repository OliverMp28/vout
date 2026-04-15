<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;

beforeEach(function (): void {
    Route::middleware(['web', 'auth', 'admin'])
        ->get('/__test/admin-zone', fn (): string => 'ok')
        ->name('test.admin-zone');
});

it('redirige al login cuando el visitante es invitado', function (): void {
    $response = $this->get('/__test/admin-zone');

    $response->assertRedirect(route('login'));
});

it('aborta con 403 si el usuario autenticado no es admin', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/__test/admin-zone')
        ->assertForbidden();
});

it('permite el paso al usuario con is_admin = true', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get('/__test/admin-zone')
        ->assertOk()
        ->assertSee('ok');
});
