<?php

use App\Enums\FacialControlSupport;
use App\Enums\GameStatus;
use App\Models\Category;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;

use function Pest\Laravel\actingAs;

function makeAppForUser(User $user, array $attributes = []): RegisteredApp
{
    return RegisteredApp::factory()
        ->forUser($user)
        ->create(array_merge([
            'allowed_origins' => ['https://games.test'],
        ], $attributes));
}

it('crea un juego con status pending_review y lo vincula a la app del dev', function (): void {
    $user = User::factory()->create();
    $app = makeAppForUser($user);
    $category = Category::factory()->create();

    $response = actingAs($user)->post(route('developers.games.store'), [
        'name' => 'Dino Runner',
        'description' => str_repeat('Un juego de dinosaurios. ', 4),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://games.test/dino',
        'cover_image' => 'https://cdn.test/cover.png',
        'category_ids' => [$category->id],
    ]);

    $game = Game::query()->where('slug', 'dino-runner')->firstOrFail();

    expect($game->submitted_by_user_id)->toBe($user->id)
        ->and($game->registered_app_id)->toBe($app->id)
        ->and($game->status)->toBe(GameStatus::PendingReview)
        ->and($game->is_active)->toBeFalse()
        ->and($game->categories->pluck('id')->all())->toBe([$category->id]);

    $response->assertRedirect(route('developers.games.show', $game));
});

it('rechaza un embed_url fuera de los allowed_origins de la app seleccionada', function (): void {
    $user = User::factory()->create();
    $app = makeAppForUser($user, ['allowed_origins' => ['https://games.test']]);
    $category = Category::factory()->create();

    $response = actingAs($user)
        ->from(route('developers.games.create'))
        ->post(route('developers.games.store'), [
            'name' => 'Rogue Pong',
            'description' => str_repeat('lorem ipsum ', 5),
            'registered_app_id' => $app->id,
            'embed_url' => 'https://otra-app.test/play',
            'category_ids' => [$category->id],
        ]);

    $response->assertRedirect(route('developers.games.create'));
    $response->assertSessionHasErrors('embed_url');
    expect(Game::query()->count())->toBe(0);
});

it('rechaza vincular el juego a una app que no pertenece al dev', function (): void {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $app = makeAppForUser($owner);
    $category = Category::factory()->create();

    $response = actingAs($intruder)
        ->from(route('developers.games.create'))
        ->post(route('developers.games.store'), [
            'name' => 'Not Mine',
            'description' => str_repeat('abcde ', 5),
            'registered_app_id' => $app->id,
            'embed_url' => 'https://games.test/x',
            'category_ids' => [$category->id],
        ]);

    $response->assertSessionHasErrors('registered_app_id');
    expect(Game::query()->count())->toBe(0);
});

it('rechaza vincular el juego a una app inactiva', function (): void {
    $user = User::factory()->create();
    $app = makeAppForUser($user, ['is_active' => false]);
    $category = Category::factory()->create();

    $response = actingAs($user)
        ->from(route('developers.games.create'))
        ->post(route('developers.games.store'), [
            'name' => 'Paused App Game',
            'description' => str_repeat('abcde ', 5),
            'registered_app_id' => $app->id,
            'embed_url' => 'https://games.test/play',
            'category_ids' => [$category->id],
        ]);

    $response->assertSessionHasErrors('registered_app_id');
    expect(Game::query()->count())->toBe(0);
});

it('exige al menos una categoría al enviar', function (): void {
    $user = User::factory()->create();
    $app = makeAppForUser($user);

    $response = actingAs($user)
        ->from(route('developers.games.create'))
        ->post(route('developers.games.store'), [
            'name' => 'Sin Categorías',
            'description' => str_repeat('abcde ', 5),
            'registered_app_id' => $app->id,
            'embed_url' => 'https://games.test/z',
            'category_ids' => [],
        ]);

    $response->assertSessionHasErrors('category_ids');
});

it('exige un invitado autenticarse para acceder al listado de juegos', function (): void {
    $response = $this->get(route('developers.games.index'));

    $response->assertRedirect(route('login'));
});

it('un juego nuevo no admite el control facial si el dev no dice nada', function (): void {
    $user = User::factory()->create();
    $app = makeAppForUser($user);
    $category = Category::factory()->create();

    actingAs($user)->post(route('developers.games.store'), [
        'name' => 'Silent Game',
        'description' => str_repeat('Un juego sin cámara. ', 4),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://games.test/silent',
        'category_ids' => [$category->id],
    ])->assertSessionHasNoErrors();

    expect(Game::query()->where('slug', 'silent-game')->firstOrFail()->facial_control_support)
        ->toBe(FacialControlSupport::None);
});

it('guarda si el juego admite el control facial', function (): void {
    $user = User::factory()->create();
    $app = makeAppForUser($user);
    $category = Category::factory()->create();

    actingAs($user)->post(route('developers.games.store'), [
        'name' => 'Face Runner',
        'description' => str_repeat('Un juego con gestos. ', 4),
        'registered_app_id' => $app->id,
        'embed_url' => 'https://games.test/face',
        'facial_control_support' => 'designed',
        'category_ids' => [$category->id],
    ])->assertSessionHasNoErrors();

    expect(Game::query()->where('slug', 'face-runner')->firstOrFail()->facial_control_support)
        ->toBe(FacialControlSupport::Designed);
});

it('rechaza un nivel de control facial que no existe', function (): void {
    $user = User::factory()->create();
    $app = makeAppForUser($user);
    $category = Category::factory()->create();

    actingAs($user)
        ->from(route('developers.games.create'))
        ->post(route('developers.games.store'), [
            'name' => 'Bad Level',
            'description' => str_repeat('lorem ipsum ', 5),
            'registered_app_id' => $app->id,
            'embed_url' => 'https://games.test/bad',
            'facial_control_support' => 'always',
            'category_ids' => [$category->id],
        ])
        ->assertSessionHasErrors('facial_control_support');

    expect(Game::query()->count())->toBe(0);
});
