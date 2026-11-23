<?php

use App\Enums\FacialControlUsage;
use App\Models\User;
use App\Models\UserSetting;

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
            'facial_control_usage' => 'primary',
            'camera_autostart' => true,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $settings = $user->settings()->first();

    expect($settings)
        ->appearance->toBe('dark')
        ->show_mascot->toBeFalse()
        ->facial_control_usage->toBe(FacialControlUsage::Primary)
        ->camera_autostart->toBeTrue();
});

test('updating appearance settings creates user settings if none exist', function () {
    $user = User::factory()->create();

    expect($user->settings()->exists())->toBeFalse();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'show_mascot' => false,
        ])
        ->assertRedirect();

    expect($user->settings()->exists())->toBeTrue();
    expect($user->settings()->first())
        ->appearance->toBe('system')
        ->show_mascot->toBeFalse()
        ->facial_control_usage->toBe(FacialControlUsage::Off)
        ->camera_autostart->toBeFalse();
});

test('appearance accepts only the whitelisted modes', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'appearance' => 'midnight',
        ])
        ->assertSessionHasErrors(['appearance']);
});

test('the facial control usage accepts only the three profiles', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'facial_control_usage' => 'always',
        ])
        ->assertSessionHasErrors([
            'facial_control_usage' => __('validation.custom.facial_control_usage_invalid'),
        ]);
});

test('booleans are validated when provided', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), [
            'show_mascot' => 'not-a-boolean',
            'camera_autostart' => 'not-a-boolean',
        ])
        ->assertSessionHasErrors(['show_mascot', 'camera_autostart']);
});

test('each setting can be saved on its own', function () {
    // Cada control de Apariencia se guarda al cambiarlo y envía solo su
    // campo: el resto no se toca.
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['appearance' => 'light'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['facial_control_usage' => 'occasional'])
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['show_mascot' => false])
        ->assertSessionHasNoErrors();

    expect($user->settings()->first())
        ->appearance->toBe('light')
        ->show_mascot->toBeFalse()
        ->facial_control_usage->toBe(FacialControlUsage::Occasional);
});

test('leaving the primary profile turns the camera autostart off', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->primaryCamera(autostart: true)->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['facial_control_usage' => 'occasional'])
        ->assertSessionHasNoErrors();

    expect($user->settings()->first())
        ->facial_control_usage->toBe(FacialControlUsage::Occasional)
        ->camera_autostart->toBeFalse();

    // Volver a elegir "juego con la cámara" no lo reactiva solo.
    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['facial_control_usage' => 'primary'])
        ->assertSessionHasNoErrors();

    expect($user->settings()->first()->camera_autostart)->toBeFalse();
});

test('the camera autostart only sticks with the primary profile', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->occasionalCamera()->create();

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['camera_autostart' => true])
        ->assertSessionHasNoErrors();

    expect($user->settings()->first()->camera_autostart)->toBeFalse();
});

test('the settings are shared with every page', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->primaryCamera(autostart: true)->create();

    $this->actingAs($user)
        ->get(route('appearance.edit'))
        ->assertInertia(fn ($page) => $page
            ->where('auth.user.settings.facial_control_usage', 'primary')
            ->where('auth.user.settings.camera_autostart', true)
        );
});
