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
            'gesture_mapping' => [
                'BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press'],
                'MOUTH_OPEN' => ['type' => 'mouse_click', 'button' => 'left'],
            ],
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
            'gesture_mapping' => [
                'BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press'],
            ],
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

    $validMapping = ['BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press']];

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 0,
            'gesture_mapping' => $validMapping,
        ])
        ->assertSessionHasErrors('sensitivity');

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 11,
            'gesture_mapping' => $validMapping,
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
            'gesture_mapping' => ['BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press']],
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
            'gesture_mapping' => ['BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press']],
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

// -----------------------------------------------------------------------
// Sesión 3 — head_tracking_mode
// -----------------------------------------------------------------------

test('head_tracking_mode defaults to cursor when not provided', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Sin modo',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => ['BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press']],
        ])
        ->assertSessionHasNoErrors();

    expect($user->gestureConfigs()->first()->head_tracking_mode)->toBe('cursor');
});

test('head_tracking_mode can be stored as gesture or disabled', function () {
    $user = User::factory()->create();

    foreach (['cursor', 'gesture', 'disabled'] as $mode) {
        $this->actingAs($user)
            ->post(route('gesture-configs.store'), [
                'profile_name' => "Modo {$mode}",
                'detection_mode' => 'face_landmarks',
                'sensitivity' => 5,
                'head_tracking_mode' => $mode,
                'gesture_mapping' => ['BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press']],
            ])
            ->assertSessionHasNoErrors();
    }

    $modes = $user->gestureConfigs()->pluck('head_tracking_mode')->toArray();
    expect($modes)->toBe(['cursor', 'gesture', 'disabled']);
});

test('head_tracking_mode can be updated independently', function () {
    $user = User::factory()->create();
    $config = GestureConfig::factory()->for($user)->create(['head_tracking_mode' => 'cursor']);

    $this->actingAs($user)
        ->put(route('gesture-configs.update', $config), [
            'head_tracking_mode' => 'gesture',
        ])
        ->assertSessionHasNoErrors();

    expect($config->fresh()->head_tracking_mode)->toBe('gesture');
});

test('validation rejects invalid head_tracking_mode', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'head_tracking_mode' => 'invalid_mode',
            'gesture_mapping' => ['BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press']],
        ])
        ->assertSessionHasErrors('head_tracking_mode');
});

// -----------------------------------------------------------------------
// Sesión 3 — gesture_mapping rich format validation
// -----------------------------------------------------------------------

test('validation rejects gesture_mapping entries with string values (formato legacy)', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => ['BROW_RAISE' => 'JUMP'], // formato antiguo — string plano
        ])
        ->assertSessionHasErrors();

    expect($user->gestureConfigs()->count())->toBe(0);
});

test('validation rejects keyboard action missing key field', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => [
                'BROW_RAISE' => ['type' => 'keyboard', 'mode' => 'press'], // falta key
            ],
        ])
        ->assertSessionHasErrors();
});

test('validation rejects keyboard action with invalid mode', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => [
                'BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'tap'], // modo inválido
            ],
        ])
        ->assertSessionHasErrors();
});

test('validation rejects mouse_click action missing button field', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Test',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => [
                'MOUTH_OPEN' => ['type' => 'mouse_click'], // falta button
            ],
        ])
        ->assertSessionHasErrors();
});

test('validation accepts all GameAction types', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'All types',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'gesture_mapping' => [
                'BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press'],
                'MOUTH_OPEN' => ['type' => 'mouse_click', 'button' => 'left'],
                'BLINK_LEFT' => ['type' => 'game_event', 'event' => 'SPECIAL'],
                'BLINK_RIGHT' => ['type' => 'none'],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect($user->gestureConfigs()->count())->toBe(1);
});

test('validation accepts HEAD_LEFT and HEAD_RIGHT as trigger keys', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('gesture-configs.store'), [
            'profile_name' => 'Head gestures',
            'detection_mode' => 'face_landmarks',
            'sensitivity' => 5,
            'head_tracking_mode' => 'gesture',
            'gesture_mapping' => [
                'HEAD_LEFT' => ['type' => 'keyboard', 'key' => 'ArrowLeft', 'mode' => 'hold'],
                'HEAD_RIGHT' => ['type' => 'keyboard', 'key' => 'ArrowRight', 'mode' => 'hold'],
                'HEAD_UP' => ['type' => 'keyboard', 'key' => 'ArrowUp', 'mode' => 'hold'],
                'HEAD_DOWN' => ['type' => 'keyboard', 'key' => 'ArrowDown', 'mode' => 'hold'],
            ],
        ])
        ->assertSessionHasNoErrors();

    $config = $user->gestureConfigs()->first();
    expect($config->head_tracking_mode)->toBe('gesture');
    expect($config->gesture_mapping)->toHaveKey('HEAD_LEFT');
});

test('update validates gesture_mapping entries when sent', function () {
    $user = User::factory()->create();
    $config = GestureConfig::factory()->for($user)->create();

    // Enviar un mapping con formato inválido en el update
    $this->actingAs($user)
        ->put(route('gesture-configs.update', $config), [
            'gesture_mapping' => [
                'BROW_RAISE' => ['type' => 'keyboard'], // falta key y mode
            ],
        ])
        ->assertSessionHasErrors();

    // El config original no debe haberse modificado
    expect($config->fresh()->gesture_mapping)->toBe($config->gesture_mapping);
});
