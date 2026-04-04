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
            'dark_mode' => true,
            'show_mascot' => false,
            'gestures_enabled' => true,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $settings = $user->settings()->first();

    expect($settings)
        ->dark_mode->toBeTrue()
        ->show_mascot->toBeFalse()
        ->gestures_enabled->toBeTrue();
});

test('updating appearance settings creates user settings if none exist', function () {
    $user = User::factory()->create();

    // El UserFactory no crea settings — verificamos que parta de cero.
    expect($user->settings()->exists())->toBeFalse();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'dark_mode' => false,
            'show_mascot' => true,
            'gestures_enabled' => false,
        ])
        ->assertRedirect();

    expect($user->settings()->exists())->toBeTrue();
    expect($user->settings()->first())
        ->dark_mode->toBeFalse()
        ->show_mascot->toBeTrue()
        ->gestures_enabled->toBeFalse();
});

test('appearance settings validation requires all fields', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [])
        ->assertSessionHasErrors(['dark_mode', 'show_mascot', 'gestures_enabled']);
});

test('appearance settings validation requires boolean values', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'dark_mode' => 'not-a-boolean',
            'show_mascot' => 'not-a-boolean',
            'gestures_enabled' => 'not-a-boolean',
        ])
        ->assertSessionHasErrors(['dark_mode', 'show_mascot', 'gestures_enabled']);
});
