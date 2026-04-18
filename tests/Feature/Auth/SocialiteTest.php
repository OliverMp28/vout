<?php

use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

it('redirects to google provider', function () {
    $response = $this->get('/auth/google/redirect');

    $response->assertRedirect();
    $this->assertStringContainsString('accounts.google.com', $response->headers->get('Location'));
});

it('creates a new user and redirects to consent interstitial', function () {
    $abstractUser = Mockery::mock(SocialiteUser::class);
    $abstractUser->shouldReceive('getId')->andReturn('google-12345');
    $abstractUser->shouldReceive('getName')->andReturn('Test User');
    $abstractUser->shouldReceive('getNickname')->andReturn('testuser');
    $abstractUser->shouldReceive('getEmail')->andReturn('test@google.com');
    $abstractUser->shouldReceive('getAvatar')->andReturn('https://google.com/avatar.jpg');

    $provider = Mockery::mock(GoogleProvider::class);
    $provider->shouldReceive('user')->andReturn($abstractUser);

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('auth.google.complete'));

    $this->assertDatabaseHas('users', [
        'email' => 'test@google.com',
        'google_id' => 'google-12345',
        'avatar' => 'https://google.com/avatar.jpg',
        'terms_accepted_at' => null,
        'privacy_version_accepted' => null,
    ]);

    $this->assertAuthenticated();
});

it('links existing native account to google and skips interstitial', function () {
    $user = User::factory()->create([
        'email' => 'existing@test.com',
        'google_id' => null,
        'avatar' => null,
        'terms_accepted_at' => now(),
        'privacy_version_accepted' => '1.0.0',
    ]);

    $abstractUser = Mockery::mock(SocialiteUser::class);
    $abstractUser->shouldReceive('getId')->andReturn('google-67890');
    $abstractUser->shouldReceive('getEmail')->andReturn('existing@test.com');
    $abstractUser->shouldReceive('getAvatar')->andReturn('https://google.com/avatar2.jpg');

    $provider = Mockery::mock(GoogleProvider::class);
    $provider->shouldReceive('user')->andReturn($abstractUser);

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('dashboard', absolute: false));

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'google_id' => 'google-67890',
        'avatar' => 'https://google.com/avatar2.jpg',
    ]);

    $this->assertAuthenticatedAs($user);
});

it('shows interstitial for newly created google user', function () {
    $user = User::factory()->withGoogle()->create([
        'terms_accepted_at' => null,
        'privacy_version_accepted' => null,
    ]);

    $response = $this->actingAs($user)->get(route('auth.google.complete'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('auth/google-complete')
        ->where('email', $user->email)
    );
});

it('redirects already-consented user away from interstitial', function () {
    $user = User::factory()->create([
        'terms_accepted_at' => now(),
        'privacy_version_accepted' => '1.0.0',
    ]);

    $response = $this->actingAs($user)->get(route('auth.google.complete'));

    $response->assertRedirect(route('dashboard', absolute: false));
});

it('persists consent from interstitial', function () {
    $user = User::factory()->withGoogle()->create([
        'terms_accepted_at' => null,
        'privacy_version_accepted' => null,
    ]);

    $response = $this->actingAs($user)->post(route('auth.google.complete.store'), [
        'accept_terms' => true,
        'confirm_age' => true,
    ]);

    $response->assertRedirect(route('dashboard', absolute: false));

    $user->refresh();
    expect($user->terms_accepted_at)->not->toBeNull();
    expect($user->privacy_version_accepted)->toBe(config('vout.legal.current_privacy_version'));
});

it('rejects interstitial submission without terms', function () {
    $user = User::factory()->withGoogle()->create([
        'terms_accepted_at' => null,
        'privacy_version_accepted' => null,
    ]);

    $response = $this->actingAs($user)
        ->from(route('auth.google.complete'))
        ->post(route('auth.google.complete.store'), [
            'accept_terms' => false,
            'confirm_age' => true,
        ]);

    $response->assertRedirect(route('auth.google.complete'));
    $response->assertSessionHasErrors('accept_terms');

    $user->refresh();
    expect($user->terms_accepted_at)->toBeNull();
});

it('cancel deletes the unconsented user and logs them out', function () {
    $user = User::factory()->withGoogle()->create([
        'terms_accepted_at' => null,
        'privacy_version_accepted' => null,
    ]);
    $userId = $user->id;

    $response = $this->actingAs($user)->post(route('auth.google.cancel'));

    $response->assertRedirect(route('login'));
    $this->assertGuest();
    expect(User::find($userId))->toBeNull();
});

it('cancel does not delete an already-consented user', function () {
    $user = User::factory()->create([
        'terms_accepted_at' => now(),
        'privacy_version_accepted' => '1.0.0',
    ]);
    $userId = $user->id;

    $this->actingAs($user)->post(route('auth.google.cancel'));

    expect(User::find($userId))->not->toBeNull();
});
