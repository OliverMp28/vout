<?php

use App\Models\Category;
use App\Models\Game;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Support\Str;
use Pest\Browser\ServerManager;

// -----------------------------------------------------------------------
// Humo del rediseño (tarea D): las páginas clave cargan sin errores de
// JavaScript en claro y en oscuro, en escritorio y en móvil, sin scroll
// horizontal, con la letra del portal cargada y con el tema que toca.
// -----------------------------------------------------------------------

beforeEach(function () {
    // La página de juego emite el token de sesión con Passport.
    $this->setUpPassport();
    registerEngineGameRoutes();
});

/**
 * Un catálogo pequeño con un juego que se maneja con gestos y que embebe una
 * página del propio servidor de test (sin salir a internet).
 */
function seedSmokeCatalog(): Game
{
    $category = Category::factory()->create(['name' => 'Plataformas', 'slug' => 'plataformas']);
    $port = parse_url(ServerManager::instance()->http()->rewrite('/'), PHP_URL_PORT);

    $games = collect(['Salto de Muelle', 'Cuarto Oscuro', 'Torre de Cajas'])
        ->map(fn (string $name, int $index) => Game::factory()->create([
            'name' => $name,
            'slug' => Str::slug($name),
            'cover_image' => null,
            'is_featured' => $index === 0,
            'facial_control_support' => $index === 0 ? 'designed' : 'none',
            'embed_url' => 'http://localhost:'.$port.'/__engine-ready-game',
        ]));

    $games->each(fn (Game $game) => $game->categories()->attach($category));

    return $games->first();
}

function actingAsSmokeAdmin(): void
{
    $user = User::factory()->create(['is_admin' => true]);
    UserSetting::factory()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    test()->actingAs($user);
}

/**
 * Comprueba la página en el tema y el dispositivo indicados.
 */
function assertSmoothPage(string $path, bool $dark, bool $mobile): void
{
    $page = visit($path);
    $page = $mobile ? $page->on()->mobile() : $page;
    $page = $dark ? $page->inDarkMode() : $page;

    $page->assertNoJavaScriptErrors()
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth + 1', true)
        ->assertScript("document.fonts.ready.then(() => document.fonts.check('16px \"Atkinson Hyperlegible Next\"'))", true)
        ->assertScript("document.documentElement.classList.contains('dark')", $dark);
}

dataset('smoke_modes', [
    'claro, escritorio' => [false, false],
    'oscuro, móvil' => [true, true],
]);

dataset('public_pages', [
    'portada' => '/',
    'catálogo' => '/catalog',
    'ficha' => '/catalog/{slug}',
    'login' => '/login',
    'registro' => '/register',
    'recuperar contraseña' => '/forgot-password',
    'desarrolladores' => '/developers',
    'privacidad' => '/legal/privacidad',
]);

dataset('account_pages', [
    'panel' => '/dashboard',
    'favoritos' => '/library/favorites',
    'perfil' => '/settings/profile',
    'apariencia' => '/settings/appearance',
    'privacidad de la cuenta' => '/settings/privacy',
    'contraseña' => '/settings/password',
    'apps conectadas' => '/settings/connected-apps',
    'apps de desarrollador' => '/developers/dashboard',
    'juego' => '/play/{slug}',
    'admin' => '/admin/dashboard',
    'admin, juegos' => '/admin/games',
]);

test('las páginas públicas cargan bien', function (string $path, bool $dark, bool $mobile) {
    $game = seedSmokeCatalog();

    assertSmoothPage(str_replace('{slug}', $game->slug, $path), $dark, $mobile);
})->with('public_pages')->with('smoke_modes');

test('las páginas con cuenta cargan bien', function (string $path, bool $dark, bool $mobile) {
    $game = seedSmokeCatalog();
    actingAsSmokeAdmin();

    assertSmoothPage(str_replace('{slug}', $game->slug, $path), $dark, $mobile);
})->with('account_pages')->with('smoke_modes');

dataset('key_pages', [
    'portada' => ['/', false],
    'catálogo' => ['/catalog', false],
    'ficha' => ['/catalog/{slug}', false],
    'login' => ['/login', false],
    'panel' => ['/dashboard', true],
    'apariencia' => ['/settings/appearance', true],
    'perfil' => ['/settings/profile', true],
    'privacidad de la cuenta' => ['/settings/privacy', true],
    'desarrolladores' => ['/developers', false],
    'admin' => ['/admin/dashboard', true],
]);

dataset('themes', [
    'claro' => false,
    'oscuro' => true,
]);

test('las páginas clave no tienen problemas serios de accesibilidad', function (string $path, bool $withAccount, bool $dark) {
    $game = seedSmokeCatalog();

    if ($withAccount) {
        actingAsSmokeAdmin();
    }

    $page = visit(str_replace('{slug}', $game->slug, $path));
    $page = $dark ? $page->inDarkMode() : $page;

    // Espera a que acaben las entradas animadas (el aviso de cookies aparece
    // con un fundido): a medio fundido el contraste aún no es el final.
    $page->assertScript(<<<'JS'
        Promise.all(
            document.getAnimations()
                .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
                .map((animation) => animation.finished.catch(() => null)),
        ).then(() => true)
    JS, true);

    $page->assertNoAccessibilityIssues();
})->with('key_pages')->with('themes');
