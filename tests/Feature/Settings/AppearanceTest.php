<?php

use App\Models\User;

// -----------------------------------------------------------------------
// Autenticación y acceso
// -----------------------------------------------------------------------

test('guests cannot access appearance page', function () {
    $this->get(route('appearance.edit'))
        ->assertRedirect(route('login'));
});

test('guests cannot update appearance settings', function () {
    $this->patch(route('user-settings.update'), [])
        ->assertRedirect(route('login'));
});

// -----------------------------------------------------------------------
// GET /settings/appearance
// -----------------------------------------------------------------------

test('appearance page renders correct Inertia component', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('appearance.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('settings/appearance')
            ->has('activeGestureConfig')
        );
});

// -----------------------------------------------------------------------
// PATCH /settings/appearance (user-settings.update)
// -----------------------------------------------------------------------

test('user can update appearance settings', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'appearance' => 'dark',
            'show_mascot' => false,
            'gestures_enabled' => true,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $settings = $user->settings()->first();

    expect($settings)
        ->appearance->toBe('dark')
        ->show_mascot->toBeFalse()
        ->gestures_enabled->toBeTrue();
});

test('updating appearance settings creates user settings if none exist', function () {
    $user = User::factory()->create();

    expect($user->settings()->exists())->toBeFalse();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'appearance' => 'system',
            'show_mascot' => true,
            'gestures_enabled' => false,
        ])
        ->assertRedirect();

    expect($user->settings()->exists())->toBeTrue();
    expect($user->settings()->first())
        ->appearance->toBe('system')
        ->show_mascot->toBeTrue()
        ->gestures_enabled->toBeFalse();
});

test('appearance accepts only the whitelisted modes', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'appearance' => 'midnight',
        ])
        ->assertSessionHasErrors(['appearance']);
});

test('booleans are validated when provided', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'show_mascot' => 'not-a-boolean',
            'gestures_enabled' => 'not-a-boolean',
        ])
        ->assertSessionHasErrors(['show_mascot', 'gestures_enabled']);
});

test('appearance can be updated independently of mascot or gestures', function () {
    // Los tabs de tema envían sólo `appearance`; el form Save sólo
    // envía mascot+gestures. Ambos canales deben funcionar por separado.
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['appearance' => 'light'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($user->settings()->first()->appearance)->toBe('light');

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'show_mascot' => false,
            'gestures_enabled' => true,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($user->settings()->first())
        ->appearance->toBe('light')
        ->show_mascot->toBeFalse()
        ->gestures_enabled->toBeTrue();
});
