<?php

use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── User ────────────────────────────────────────────────────

it('puede crear un usuario con factory', function () {
    $user = User::factory()->create();

    expect($user)->toBeInstanceOf(User::class)
        ->and($user->id)->toBeGreaterThan(0);
});

it('usuario puede tener settings (hasOne)', function () {
    $user = User::factory()->create();
    $setting = UserSetting::factory()->create(['user_id' => $user->id]);

    expect($user->settings)->toBeInstanceOf(UserSetting::class)
        ->and($user->settings->id)->toBe($setting->id);
});

it('usuario puede tener múltiples configuraciones de gestos (hasMany)', function () {
    $user = User::factory()->create();
    GestureConfig::factory()->count(3)->create(['user_id' => $user->id]);

    expect($user->gestureConfigs)->toHaveCount(3);
});

it('usuario puede tener juegos favoritos (belongsToMany)', function () {
    $user = User::factory()->create();
    $game = Game::factory()->create();

    $user->games()->attach($game->id, [
        'is_favorite' => true,
        'is_saved' => false,
        'play_count' => 5,
        'best_score' => 100,
    ]);

    expect($user->games)->toHaveCount(1)
        ->and($user->games->first()->pivot->is_favorite)->toBeTruthy()
        ->and($user->games->first()->pivot->play_count)->toBe(5);
});

it('usuario con google tiene has_google_linked en true', function () {
    $user = User::factory()->withGoogle()->create();

    expect($user->has_google_linked)->toBeTrue();
});

it('usuario sin google tiene has_google_linked en false', function () {
    $user = User::factory()->create();

    expect($user->has_google_linked)->toBeFalse();
});

it('scope withGoogle filtra usuarios con cuenta google', function () {
    User::factory()->count(2)->create();
    User::factory()->withGoogle()->count(3)->create();

    expect(User::query()->withGoogle()->count())->toBe(3);
});

// ─── Category ────────────────────────────────────────────────

it('puede crear una categoría con factory', function () {
    $category = Category::factory()->create();

    expect($category->slug)->not->toBeEmpty()
        ->and($category->getRouteKeyName())->toBe('slug');
});

it('categoría tiene relación con juegos (belongsToMany)', function () {
    $category = Category::factory()->create();
    $games = Game::factory()->count(2)->create();

    $category->games()->attach($games->pluck('id'));

    expect($category->games)->toHaveCount(2);
});

// ─── Developer ───────────────────────────────────────────────

it('puede crear un desarrollador con factory', function () {
    $developer = Developer::factory()->create();

    expect($developer->slug)->not->toBeEmpty()
        ->and($developer->getRouteKeyName())->toBe('slug');
});

it('desarrollador tiene juegos con rol en pivot (belongsToMany)', function () {
    $developer = Developer::factory()->create();
    $game = Game::factory()->create();

    $developer->games()->attach($game->id, ['role' => 'Programador Principal']);

    $developer->refresh();

    expect($developer->games)->toHaveCount(1)
        ->and($developer->games->first()->pivot->role)->toBe('Programador Principal');
});

// ─── Game ────────────────────────────────────────────────────

it('puede crear un juego con factory', function () {
    $game = Game::factory()->create();
    $category = Category::factory()->create();

    $game->categories()->attach($category->id);

    expect($game->categories)->toHaveCount(1)
        ->and($game->categories->first())->toBeInstanceOf(Category::class)
        ->and($game->getRouteKeyName())->toBe('slug');
});

it('juego castea is_active y is_featured como booleanos', function () {
    $game = Game::factory()->create(['is_active' => true, 'is_featured' => false]);

    expect($game->is_active)->toBeBool()->toBeTrue()
        ->and($game->is_featured)->toBeBool()->toBeFalse();
});

it('scope active filtra solo juegos activos', function () {
    Game::factory()->count(3)->create(['is_active' => true]);
    Game::factory()->inactive()->count(2)->create();

    expect(Game::query()->active()->count())->toBe(3);
});

it('scope featured filtra solo juegos destacados', function () {
    Game::factory()->count(2)->create(['is_featured' => false]);
    Game::factory()->featured()->count(1)->create();

    expect(Game::query()->featured()->count())->toBe(1);
});

// ─── GestureConfig ───────────────────────────────────────────

it('gesture_mapping se castea como array', function () {
    $config = GestureConfig::factory()->create();

    expect($config->gesture_mapping)->toBeArray()
        ->and($config->gesture_mapping)->toHaveKey('BROW_RAISE');
});

it('gesture config pertenece a un usuario', function () {
    $config = GestureConfig::factory()->create();

    expect($config->user)->toBeInstanceOf(User::class);
});

// ─── UserSetting ─────────────────────────────────────────────

it('user setting castea booleanos y persiste appearance correctamente', function () {
    $setting = UserSetting::factory()->create([
        'appearance' => 'dark',
        'show_mascot' => false,
        'gestures_enabled' => true,
    ]);

    expect($setting->appearance)->toBe('dark')
        ->and($setting->show_mascot)->toBeBool()->toBeFalse()
        ->and($setting->gestures_enabled)->toBeBool()->toBeTrue();
});

it('user setting pertenece a un usuario', function () {
    $setting = UserSetting::factory()->create();

    expect($setting->user)->toBeInstanceOf(User::class);
});

// ─── RegisteredApp ───────────────────────────────────────────

it('allowed_origins se castea como array', function () {
    $app = RegisteredApp::factory()->create();

    expect($app->allowed_origins)->toBeArray()
        ->and($app->allowed_origins)->not->toBeEmpty();
});

it('scope active filtra solo apps activas', function () {
    RegisteredApp::factory()->count(2)->create(['is_active' => true]);
    RegisteredApp::factory()->inactive()->count(1)->create();

    expect(RegisteredApp::query()->active()->count())->toBe(2);
});

it('registered app usa slug como route key', function () {
    $app = RegisteredApp::factory()->create();

    expect($app->getRouteKeyName())->toBe('slug');
});
