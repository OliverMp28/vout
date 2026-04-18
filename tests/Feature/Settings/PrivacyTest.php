<?php

use App\Models\GestureConfig;
use App\Models\User;
use App\Models\UserSetting;

test('privacy page is displayed for authenticated users', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('privacy.edit'));

    $response->assertOk();
});

test('privacy page redirects unauthenticated users to login', function () {
    $response = $this->get(route('privacy.edit'));

    $response->assertRedirect(route('login'));
});

test('privacy page surfaces current and accepted policy versions', function () {
    config()->set('vout.legal.current_privacy_version', '2.1.0');

    $user = User::factory()->create([
        'terms_accepted_at' => now()->subMonth(),
        'privacy_version_accepted' => '1.0.0',
    ]);

    $response = $this
        ->actingAs($user)
        ->get(route('privacy.edit'));

    $response
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('settings/privacy')
            ->where('consent.privacy_version_accepted', '1.0.0')
            ->where('consent.current_privacy_version', '2.1.0')
            ->where('consent.needs_reacceptance', true),
        );
});

test('export requires authentication', function () {
    $response = $this->get(route('privacy.export'));

    $response->assertRedirect(route('login'));
});

test('export returns a JSON download with the expected shape', function () {
    $user = User::factory()->create([
        'name' => 'Ada Lovelace',
        'email' => 'ada@example.com',
        'username' => 'ada',
    ]);
    UserSetting::factory()->create(['user_id' => $user->id, 'appearance' => 'dark']);
    GestureConfig::factory()->create([
        'user_id' => $user->id,
        'profile_name' => 'Default',
    ]);

    $response = $this
        ->actingAs($user)
        ->get(route('privacy.export'));

    $response
        ->assertOk()
        ->assertHeader('content-type', 'application/json');

    expect($response->headers->get('content-disposition'))
        ->toContain('vout-mis-datos-')
        ->toContain('.json');

    $payload = json_decode($response->streamedContent(), true);

    expect($payload)
        ->toBeArray()
        ->toHaveKeys(['metadata', 'user', 'settings', 'gesture_configs', 'games_played', 'registered_apps']);

    expect($payload['user'])
        ->toHaveKey('email', 'ada@example.com')
        ->toHaveKey('username', 'ada')
        ->toHaveKey('name', 'Ada Lovelace');

    expect($payload['settings']['appearance'])->toBe('dark');
    expect($payload['gesture_configs'])->toHaveCount(1);
    expect($payload['gesture_configs'][0]['profile_name'])->toBe('Default');
});

test('export never leaks password hash, 2fa secrets or remember token', function () {
    $user = User::factory()->create([
        'two_factor_secret' => encrypt('secret'),
        'two_factor_recovery_codes' => encrypt(json_encode(['recovery'])),
        'remember_token' => 'remember-me-123',
    ]);

    $response = $this
        ->actingAs($user)
        ->get(route('privacy.export'));

    $body = $response->streamedContent();

    expect($body)
        ->not->toContain($user->password)
        ->not->toContain('remember-me-123')
        ->not->toContain('two_factor_secret')
        ->not->toContain('two_factor_recovery_codes')
        ->not->toContain('remember_token');
});

test('user can exercise their right to erasure via privacy.destroy', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('privacy.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('destroy rejects wrong password and keeps the account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('privacy.edit'))
        ->delete(route('privacy.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('privacy.edit'));

    expect($user->fresh())->not->toBeNull();
});

test('destroy requires authentication', function () {
    $response = $this->delete(route('privacy.destroy'), [
        'password' => 'password',
    ]);

    $response->assertRedirect(route('login'));
});
