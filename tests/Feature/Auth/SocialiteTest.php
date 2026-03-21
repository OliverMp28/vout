<?php

use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

it('redirects to google provider', function () {
    $response = $this->get('/auth/google/redirect');

    $response->assertRedirect();
    $this->assertStringContainsString('accounts.google.com', $response->headers->get('Location'));
});

it('creates a new user and logs them in', function () {
    $abstractUser = Mockery::mock(SocialiteUser::class);
    $abstractUser->shouldReceive('getId')->andReturn('google-12345');
    $abstractUser->shouldReceive('getName')->andReturn('Test User');
    $abstractUser->shouldReceive('getNickname')->andReturn('testuser');
    $abstractUser->shouldReceive('getEmail')->andReturn('test@google.com');
    $abstractUser->shouldReceive('getAvatar')->andReturn('https://google.com/avatar.jpg');

    $provider = Mockery::mock(\Laravel\Socialite\Two\GoogleProvider::class);
    $provider->shouldReceive('user')->andReturn($abstractUser);

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('dashboard', absolute: false));

    $this->assertDatabaseHas('users', [
        'email' => 'test@google.com',
        'google_id' => 'google-12345',
        'avatar' => 'https://google.com/avatar.jpg',
    ]);

    $this->assertAuthenticated();
});

it('links existing native account to google and logs them in', function () {
    $user = User::factory()->create([
        'email' => 'existing@test.com',
        'google_id' => null,
        'avatar' => null,
    ]);

    $abstractUser = Mockery::mock(SocialiteUser::class);
    $abstractUser->shouldReceive('getId')->andReturn('google-67890');
    $abstractUser->shouldReceive('getEmail')->andReturn('existing@test.com');
    $abstractUser->shouldReceive('getAvatar')->andReturn('https://google.com/avatar2.jpg');

    $provider = Mockery::mock(\Laravel\Socialite\Two\GoogleProvider::class);
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
