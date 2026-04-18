<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

function mockGoogleUser(array $overrides = []): SocialiteUser
{
    $defaults = [
        'getId' => 'google-12345',
        'getName' => 'Test User',
        'getNickname' => 'testuser',
        'getEmail' => 'test@google.com',
        'getAvatar' => 'https://lh3.googleusercontent.com/a/avatar.jpg',
    ];

    $abstractUser = Mockery::mock(SocialiteUser::class);
    foreach (array_merge($defaults, $overrides) as $method => $value) {
        $abstractUser->shouldReceive($method)->andReturn($value);
    }

    $provider = Mockery::mock(GoogleProvider::class);
    $provider->shouldReceive('user')->andReturn($abstractUser);

    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

    return $abstractUser;
}

it('redirects to google provider', function () {
    $response = $this->get('/auth/google/redirect');

    $response->assertRedirect();
    $this->assertStringContainsString('accounts.google.com', $response->headers->get('Location'));
});

it('creates a new user, downloads avatar locally, and redirects to consent interstitial', function () {
    Storage::fake('public');
    Http::fake([
        'lh3.googleusercontent.com/*' => Http::response(
            fakePngBytes(),
            200,
            ['Content-Type' => 'image/png']
        ),
    ]);

    mockGoogleUser(['getEmail' => 'test@google.com']);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('auth.google.complete'));

    $user = User::where('email', 'test@google.com')->firstOrFail();
    expect($user->google_id)->toBe('google-12345')
        ->and($user->avatar)->toStartWith('/storage/avatars/')
        ->and($user->avatar)->toEndWith('.png')
        ->and($user->terms_accepted_at)->toBeNull();

    Storage::disk('public')->assertExists(str_replace('/storage/', '', $user->avatar));
    $this->assertAuthenticated();
});

it('creates a new user with null avatar when google download fails', function () {
    Storage::fake('public');
    Http::fake([
        'lh3.googleusercontent.com/*' => Http::response('', 429),
    ]);

    mockGoogleUser(['getEmail' => 'ratelimited@google.com']);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('auth.google.complete'));

    $this->assertDatabaseHas('users', [
        'email' => 'ratelimited@google.com',
        'avatar' => null,
    ]);
});

it('links existing native account and downloads google avatar locally', function () {
    Storage::fake('public');
    Http::fake([
        'lh3.googleusercontent.com/*' => Http::response(
            fakePngBytes(),
            200,
            ['Content-Type' => 'image/png']
        ),
    ]);

    $user = User::factory()->create([
        'email' => 'existing@test.com',
        'google_id' => null,
        'avatar' => null,
        'terms_accepted_at' => now(),
        'privacy_version_accepted' => '1.0.0',
    ]);

    mockGoogleUser([
        'getId' => 'google-67890',
        'getEmail' => 'existing@test.com',
    ]);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('dashboard', absolute: false));

    $user->refresh();
    expect($user->google_id)->toBe('google-67890')
        ->and($user->avatar)->toStartWith('/storage/avatars/');

    $this->assertAuthenticatedAs($user);
});

it('preserves user-uploaded local avatar when linking google', function () {
    Storage::fake('public');
    Http::fake();

    $user = User::factory()->create([
        'email' => 'existing@test.com',
        'google_id' => null,
        'avatar' => '/storage/avatars/user-uploaded.png',
        'terms_accepted_at' => now(),
        'privacy_version_accepted' => '1.0.0',
    ]);

    mockGoogleUser(['getEmail' => 'existing@test.com']);

    $this->get('/auth/google/callback');

    expect($user->fresh()->avatar)->toBe('/storage/avatars/user-uploaded.png');
    Http::assertNothingSent();
});

it('migrates legacy external avatar to local copy on next google login', function () {
    Storage::fake('public');
    Http::fake([
        'lh3.googleusercontent.com/*' => Http::response(
            fakePngBytes(),
            200,
            ['Content-Type' => 'image/png']
        ),
    ]);

    $user = User::factory()->create([
        'email' => 'legacy@test.com',
        'google_id' => 'google-legacy',
        'avatar' => 'https://lh3.googleusercontent.com/a/old-url.jpg',
        'terms_accepted_at' => now(),
        'privacy_version_accepted' => '1.0.0',
    ]);

    mockGoogleUser([
        'getId' => 'google-legacy',
        'getEmail' => 'legacy@test.com',
    ]);

    $this->get('/auth/google/callback');

    $fresh = $user->fresh();
    expect($fresh->avatar)->toStartWith('/storage/avatars/')
        ->and($fresh->avatar)->not->toStartWith('http');
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
