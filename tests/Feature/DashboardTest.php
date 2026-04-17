<?php

use App\Models\Category;
use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

test('new user sees onboarding hero and empty continue playing', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->where('onboarding.show', true)
            ->where('continuePlaying', null)
            ->where('stats.gamesPlayed', 0)
            ->where('stats.totalPlays', 0)
            ->where('ecosystem.isDeveloper', false)
            ->where('ecosystem.isAdmin', false)
        );
});

test('continue playing returns the most recently played game', function () {
    $user = User::factory()->create();
    $older = Game::factory()->create(['is_active' => true]);
    $newer = Game::factory()->create(['is_active' => true]);

    $user->games()->attach($older->id, [
        'play_count' => 3,
        'last_played_at' => now()->subDays(2),
    ]);
    $user->games()->attach($newer->id, [
        'play_count' => 1,
        'last_played_at' => now()->subMinutes(5),
        'best_score' => 420,
    ]);

    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('continuePlaying.data.id', $newer->id)
            ->where('continuePlaying.data.user_interaction.best_score', 420)
            ->where('stats.gamesPlayed', 2)
            ->where('stats.totalPlays', 4)
            ->where('onboarding.show', false)
        );
});

test('stats top category is the one with highest play_count sum', function () {
    $user = User::factory()->create();
    $arcade = Category::factory()->create(['name' => 'Arcade']);
    $puzzle = Category::factory()->create(['name' => 'Puzzle']);

    $arcadeGame = Game::factory()->create();
    $arcadeGame->categories()->attach($arcade->id);
    $puzzleGame = Game::factory()->create();
    $puzzleGame->categories()->attach($puzzle->id);

    $user->games()->attach($arcadeGame->id, [
        'play_count' => 10,
        'last_played_at' => now(),
    ]);
    $user->games()->attach($puzzleGame->id, [
        'play_count' => 2,
        'last_played_at' => now(),
    ]);

    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('stats.topCategoryName', 'Arcade')
            ->where('recommendationReason.params.category', 'Arcade')
        );
});

test('recommendations exclude games the user has already played', function () {
    $user = User::factory()->create();
    $arcade = Category::factory()->create(['name' => 'Arcade']);

    $played = Game::factory()->create(['is_active' => true]);
    $played->categories()->attach($arcade->id);

    $candidate = Game::factory()->create(['is_active' => true]);
    $candidate->categories()->attach($arcade->id);

    $user->games()->attach($played->id, [
        'play_count' => 5,
        'last_played_at' => now(),
    ]);

    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->has('recommendations.data', 1)
            ->where('recommendations.data.0.id', $candidate->id)
        );
});

test('recommendations fallback to popular active games when user has no history', function () {
    $user = User::factory()->create();
    Game::factory()->count(3)->create(['is_active' => true]);

    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->has('recommendations.data', 3)
            ->where('recommendationReason', null)
        );
});

test('ecosystem reports developer status when user has registered apps', function () {
    $user = User::factory()->create();
    RegisteredApp::factory()->count(2)->forUser($user)->create();

    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('ecosystem.isDeveloper', true)
            ->where('ecosystem.developerAppsCount', 2)
        );
});

test('ecosystem reports admin status for admin users', function () {
    $user = User::factory()->admin()->create();

    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('ecosystem.isAdmin', true)
        );
});

test('onboarding step gestures is done when user has an active gesture config', function () {
    $user = User::factory()->create();
    GestureConfig::factory()->active()->for($user)->create();

    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('onboarding.steps.1.key', 'gestures')
            ->where('onboarding.steps.1.done', true)
        );
});

test('dismissing the onboarding persists dashboard_welcome_dismissed_at', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->post(route('dashboard.welcome.dismiss'))
        ->assertRedirect();

    $setting = UserSetting::where('user_id', $user->id)->first();
    expect($setting)->not->toBeNull();
    expect($setting->dashboard_welcome_dismissed_at)->not->toBeNull();

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('onboarding.show', false)
        );
});

test('ecosystem exposes the vout id', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('ecosystem.voutId', $user->vout_id)
        );
});

test('guests cannot dismiss the onboarding', function () {
    $this->post(route('dashboard.welcome.dismiss'))
        ->assertRedirect(route('login'));
});
