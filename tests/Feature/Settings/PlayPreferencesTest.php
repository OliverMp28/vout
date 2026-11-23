<?php

use App\Models\User;
use App\Models\UserSetting;

it('guarda el panel y la vista de la cámara con la cuenta', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->primaryCamera()->create();

    $this->actingAs($user)
        ->patchJson(route('play-preferences.update'), [
            'play_panel_open' => false,
            'show_camera_preview' => true,
        ])
        ->assertNoContent();

    expect($user->settings()->first())
        ->play_panel_open->toBeFalse()
        ->show_camera_preview->toBeTrue();
});

it('crea los ajustes si aún no existen', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson(route('play-preferences.update'), ['play_panel_open' => true])
        ->assertNoContent();

    expect($user->settings()->first())
        ->play_panel_open->toBeTrue()
        ->show_camera_preview->toBeFalse();
});

it('cada preferencia se guarda por separado', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['play_panel_open' => true]);

    $this->actingAs($user)
        ->patchJson(route('play-preferences.update'), ['show_camera_preview' => true])
        ->assertNoContent();

    expect($user->settings()->first())
        ->play_panel_open->toBeTrue()
        ->show_camera_preview->toBeTrue();
});

it('no toca el resto de ajustes', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->primaryCamera(autostart: true)->create(['appearance' => 'dark']);

    $this->actingAs($user)
        ->patchJson(route('play-preferences.update'), [
            'play_panel_open' => true,
            'facial_control_usage' => 'off',
            'appearance' => 'light',
        ])
        ->assertNoContent();

    expect($user->settings()->first())
        ->appearance->toBe('dark')
        ->camera_autostart->toBeTrue()
        ->facial_control_usage->value->toBe('primary');
});

it('rechaza valores que no son sí o no', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patchJson(route('play-preferences.update'), [
            'play_panel_open' => 'maybe',
            'show_camera_preview' => 'yes-please',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['play_panel_open', 'show_camera_preview']);
});

it('exige sesión iniciada', function () {
    $this->patchJson(route('play-preferences.update'), ['play_panel_open' => true])
        ->assertUnauthorized();
});

it('cambiar de perfil de uso olvida cómo se dejó el panel', function () {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->occasionalCamera()->create(['play_panel_open' => true]);

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['facial_control_usage' => 'primary'])
        ->assertSessionHasNoErrors();

    expect($user->settings()->first()->play_panel_open)->toBeNull();

    // Guardar otra cosa sin cambiar de perfil no lo olvida.
    $user->settings()->first()->update(['play_panel_open' => false]);

    $this->actingAs($user)
        ->patch(route('user-settings.update'), ['show_mascot' => false])
        ->assertSessionHasNoErrors();

    expect($user->settings()->first()->play_panel_open)->toBeFalse();
});
