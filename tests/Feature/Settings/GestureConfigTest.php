<?php

use App\Models\GestureConfig;
use App\Models\User;

// -----------------------------------------------------------------------
// Authentication & authorization
// -----------------------------------------------------------------------

test('guests cannot access gesture config endpoints', function () {
    $this->post(route('gesture-configs.store'), [])
        ->assertRedirect(route('login'));

    $config = GestureConfig::factory()->create();

    $this->put(route('gesture-configs.update', $config), [])
        ->assertRedirect(route('login'));

    $this->delete(route('gesture-configs.destroy', $config))
        ->assertRedirect(route('login'));
});

test('users cannot update another users gesture config', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    $config = GestureConfig::factory()->for($owner)->create();

    $this->actingAs($other)
        ->put(route('gesture-configs.update', $config), [
            'sensitivity' => 8,
        ])
        ->assertForbidden();
});

test('users cannot delete another users gesture config', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    $config = GestureConfig::factory()->for($owner)->create();

    $this->actingAs($other)
        ->delete(route('gesture-configs.destroy', $config))
        ->assertForbidden();
});

// -----------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------

test('authenticated user can create a gesture config', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Default',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => ['BROW_RAISE' => 'JUMP', 'MOUTH_OPEN' => 'SHOOT'],
            'is_active' => true,
        ]);

    $response->assertRedirect();
    $response->assertSessionHasNoErrors();

    expect($user->gestureConfigs()->count())->toBe(1);
    expect($user->gestureConfigs()->first())
        ->profile_name->toBe('Default')
        ->sensitivity->toBe(5)
        ->is_active->toBeTrue();
});

test('creating an active config deactivates existing active configs', function () {
    $user = User::factory()->create();
    $existing = GestureConfig::factory()->for($user)->active()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'New Profile',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 7,
            'gesture_mapping' => ['BROW_RAISE' => 'JUMP'],
            'is_active' => true,
        ]);

    $existing->refresh();
    expect($existing->is_active)->toBeFalse();
    expect($user->gestureConfigs()->where('is_active', true)->count())->toBe(1);
});

// -----------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------

test('user can update own gesture config sensitivity', function () {
    $user = User::factory()->create();
    $config = GestureConfig::factory()->for($user)->create(['sensitivity' => 5]);

    $this->actingAs($user)
        ->put(route('gesture-configs.update', $config), [
            'sensitivity' => 8,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $config->refresh();
    expect($config->sensitivity)->toBe(8);
});

test('activating a config deactivates siblings', function () {
    $user = User::factory()->create();
    $active = GestureConfig::factory()->for($user)->active()->create();
    $inactive = GestureConfig::factory()->for($user)->create();

    $this->actingAs($user)
        ->put(route('gesture-configs.update', $inactive), [
            'is_active' => true,
        ]);

    $active->refresh();
    $inactive->refresh();

    expect($active->is_active)->toBeFalse();
    expect($inactive->is_active)->toBeTrue();
});

// -----------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------

test('user can delete own gesture config', function () {
    $user = User::factory()->create();
    $config = GestureConfig::factory()->for($user)->create();

    $this->actingAs($user)
        ->delete(route('gesture-configs.destroy', $config))
        ->assertRedirect();

    expect(GestureConfig::find($config->id))->toBeNull();
});

// -----------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------

test('store validates required fields', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [])
        ->assertSessionHasErrors(['profile_name', 'detection_mode', 'sensitivity', 'gesture_mapping']);
});

test('sensitivity must be between 1 and 10', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 0,
            'gesture_mapping' => ['BROW_RAISE' => 'JUMP'],
        ])
        ->assertSessionHasErrors('sensitivity');

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 11,
            'gesture_mapping' => ['BROW_RAISE' => 'JUMP'],
        ])
        ->assertSessionHasErrors('sensitivity');
});

test('detection_mode must be a valid value', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'invalid_mode',
            'sensitivity' => 5,
            'gesture_mapping' => ['BROW_RAISE' => 'JUMP'],
        ])
        ->assertSessionHasErrors('detection_mode');
});

// -----------------------------------------------------------------------
// Integración con user_settings
// -----------------------------------------------------------------------

test('creating an active gesture config enables gestures in user settings', function () {
    $user = User::factory()->create();

    // El usuario parte sin settings y sin perfiles de gestos.
    expect($user->settings()->exists())->toBeFalse();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Default',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => ['BROW_RAISE' => 'JUMP'],
            'is_active' => true,
        ]);

    // GestureConfigController::store() debe activar gestures_enabled automáticamente.
    expect($user->settings()->first()->gestures_enabled)->toBeTrue();
});

// -----------------------------------------------------------------------
// Appearance page
// -----------------------------------------------------------------------

test('appearance page loads with active gesture config prop', function () {
    $user = User::factory()->create();
    $config = GestureConfig::factory()->for($user)->active()->create([
        'profile_name' => 'Mi Perfil',
    ]);

    $this->actingAs($user)
        ->get(route('appearance.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('settings/appearance')
            ->has('activeGestureConfig')
            ->where('activeGestureConfig.profile_name', 'Mi Perfil')
        );
});

test('appearance page loads without gesture config when none exists', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('appearance.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('settings/appearance')
            ->where('activeGestureConfig', null)
        );
});
