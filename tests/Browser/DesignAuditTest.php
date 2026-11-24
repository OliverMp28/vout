<?php

use App\Models\Category;
use App\Models\Game;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Support\Str;

// -----------------------------------------------------------------------
// Capturas del rediseño (tarea D): las pantallas clave en claro y oscuro,
// en escritorio y móvil, para comparar el antes y el después de cada fase.
// No comprueba nada: solo guarda imágenes. Se salta salvo con VOUT_AUDIT=1:
//
//   VOUT_AUDIT=1 VOUT_AUDIT_PHASE=antes vendor/bin/sail artisan test --compact tests/Browser/DesignAuditTest.php
//
// Las imágenes quedan en tests/Browser/Screenshots/<fase>/ (en .gitignore).
// La subcarpeta sobrevive a la limpieza que Pest hace al arrancar.
// -----------------------------------------------------------------------

beforeEach(function () {
    if (! env('VOUT_AUDIT')) {
        $this->markTestSkipped('Capturas del rediseño: solo con VOUT_AUDIT=1.');
    }

    // La página de juego emite el token de sesión con Passport.
    $this->setUpPassport();
    registerEngineGameRoutes();
});

/**
 * Catálogo creíble: categorías, un destacado pensado para la cara, algunos
 * compatibles y el resto sin portada (como la mayoría de juegos reales).
 */
function seedAuditCatalog(): Game
{
    $categories = collect(['Plataformas', 'Puzle', 'Arcade', 'Habilidad'])
        ->map(fn (string $name) => Category::factory()->create(['name' => $name, 'slug' => Str::slug($name)]));

    $names = [
        ['Salto de Muelle', 'designed', 4210],
        ['Cuarto Oscuro', 'compatible', 2875],
        ['Torre de Cajas', 'none', 1960],
        ['Bichos en Fila', 'compatible', 1433],
        ['Eco', 'none', 988],
        ['Pesca Nocturna', 'none', 642],
        ['Tres en Raya Rápido', 'none', 310],
        ['Globo y Púas', 'designed', 127],
    ];

    $games = collect($names)->map(fn (array $row, int $index) => Game::factory()->create([
        'name' => $row[0],
        'slug' => Str::slug($row[0]),
        'description' => 'Un juego corto para el navegador: se aprende en segundos y se juega con el teclado o con la cara si lo admite.',
        'cover_image' => null,
        'facial_control_support' => $row[1],
        'play_count' => $row[2],
        'is_featured' => $index < 3,
    ]));

    $games->each(fn (Game $game, int $index) => $game->categories()->attach($categories[$index % $categories->count()]));

    return $games->first();
}

/**
 * Guarda la captura de la página en claro u oscuro y escritorio o móvil.
 */
function auditShot(string $path, string $name, bool $dark, bool $mobile): void
{
    $phase = env('VOUT_AUDIT_PHASE', 'antes');
    @mkdir(base_path("tests/Browser/Screenshots/{$phase}"), 0755, true);

    $page = visit($path);
    $page = $mobile ? $page->on()->mobile() : $page;
    $page = $dark ? $page->inDarkMode() : $page;

    $page->wait(1.5);
    $filename = $page->screenshot(fullPage: true, filename: sprintf(
        '%s/%s-%s-%s',
        $phase,
        $name,
        $dark ? 'oscuro' : 'claro',
        $mobile ? 'movil' : 'escritorio',
    ));

    expect($filename)->not->toBeEmpty();
}

dataset('audit_modes', [
    'claro escritorio' => [false, false],
    'oscuro escritorio' => [true, false],
    'claro movil' => [false, true],
    'oscuro movil' => [true, true],
]);

test('capturas de las páginas públicas', function (bool $dark, bool $mobile) {
    $game = seedAuditCatalog();

    auditShot('/', 'portada', $dark, $mobile);
    auditShot('/catalog', 'catalogo', $dark, $mobile);
    auditShot('/catalog/'.$game->slug, 'ficha', $dark, $mobile);
    auditShot('/login', 'login', $dark, $mobile);
    auditShot('/developers', 'desarrolladores', $dark, $mobile);
})->with('audit_modes');

test('capturas del panel y los ajustes', function (bool $dark, bool $mobile) {
    seedAuditCatalog();

    $user = User::factory()->create(['is_admin' => true, 'name' => 'Oliver Prueba']);
    UserSetting::factory()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    Game::query()->orderBy('id')->take(3)->get()->each(
        fn (Game $game, int $index) => $user->games()->attach($game->id, ['last_played_at' => now()->subDays($index), 'play_count' => 3 - $index]),
    );
    $this->actingAs($user);

    auditShot('/', 'portada-cuenta', $dark, $mobile);

    auditShot('/dashboard', 'panel', $dark, $mobile);
    auditShot('/settings/appearance', 'apariencia', $dark, $mobile);
    auditShot('/admin/games', 'admin-juegos', $dark, $mobile);
})->with('audit_modes');

test('capturas de la página de juego', function (bool $dark, bool $mobile) {
    $game = engineTestGame(usage: 'primary', announcesReady: true, support: 'designed', panelOpen: true);

    auditShot('/play/'.$game->slug, 'juego', $dark, $mobile);
})->with('audit_modes');

// -----------------------------------------------------------------------
// Parte 2 del rediseño: el resto de pantallas, en claro y oscuro (escritorio)
// y en claro (móvil).
// -----------------------------------------------------------------------

dataset('audit_modes_parte2', [
    'claro escritorio' => [false, false],
    'oscuro escritorio' => [true, false],
    'claro movil' => [false, true],
]);

/**
 * Administrador con ajustes, una app de terceros autorizada, una app propia
 * con su juego y actividad para el registro de auditoría.
 *
 * @return array{user: User, app: RegisteredApp, game: Game}
 */
function seedAuditAccount(): array
{
    seedAuditCatalog();

    $user = User::factory()->create(['is_admin' => true, 'name' => 'Oliver Prueba']);
    UserSetting::factory()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);

    $thirdParty = gameWithOAuthApp(['name' => 'Daino']);
    authorizeGameApp($user, $thirdParty);

    $app = RegisteredApp::factory()->forUser($user)->withClient()->create(['name' => 'Mi Estudio']);
    $game = Game::factory()->forApp($app)->submittedBy($user)->pendingReview()->create([
        'name' => 'Rana Saltarina',
        'slug' => 'rana-saltarina',
        'cover_image' => null,
    ]);

    return ['user' => $user, 'app' => $app, 'game' => $game];
}

test('capturas de los ajustes', function (bool $dark, bool $mobile) {
    ['user' => $user] = seedAuditAccount();
    $this->actingAs($user);

    auditShot('/settings/profile', 'ajustes-perfil', $dark, $mobile);
    auditShot('/settings/password', 'ajustes-contrasena', $dark, $mobile);
    auditShot('/settings/two-factor', 'ajustes-2fa', $dark, $mobile);
    auditShot('/settings/privacy', 'ajustes-privacidad', $dark, $mobile);
    auditShot('/settings/connected-apps', 'ajustes-apps', $dark, $mobile);
    auditShot('/library/favorites', 'favoritos', $dark, $mobile);
})->with('audit_modes_parte2');

test('capturas del portal de desarrolladores', function (bool $dark, bool $mobile) {
    ['user' => $user, 'app' => $app, 'game' => $game] = seedAuditAccount();
    $this->actingAs($user);

    auditShot('/developers/dashboard', 'dev-apps', $dark, $mobile);
    auditShot('/developers/apps/create', 'dev-app-nueva', $dark, $mobile);
    auditShot('/developers/apps/'.$app->slug, 'dev-app', $dark, $mobile);
    auditShot('/developers/dashboard/games', 'dev-juegos', $dark, $mobile);
    auditShot('/developers/dashboard/games/create', 'dev-juego-nuevo', $dark, $mobile);
    auditShot('/developers/dashboard/games/'.$game->slug, 'dev-juego', $dark, $mobile);
    auditShot('/developers/dashboard/profile', 'dev-perfil', $dark, $mobile);
    auditShot('/developers/docs/integration-guide', 'dev-guia', $dark, $mobile);
})->with('audit_modes_parte2');

test('capturas del admin', function (bool $dark, bool $mobile) {
    ['user' => $user, 'app' => $app, 'game' => $game] = seedAuditAccount();
    $this->actingAs($user);

    auditShot('/admin/dashboard', 'admin-panel', $dark, $mobile);
    auditShot('/admin/games/'.$game->slug, 'admin-juego', $dark, $mobile);
    auditShot('/admin/apps', 'admin-apps', $dark, $mobile);
    auditShot('/admin/apps/'.$app->slug, 'admin-app', $dark, $mobile);
    auditShot('/admin/categories', 'admin-categorias', $dark, $mobile);
    auditShot('/admin/categories/create', 'admin-categoria-nueva', $dark, $mobile);
    auditShot('/admin/developers', 'admin-desarrolladores', $dark, $mobile);
    auditShot('/admin/audit', 'admin-auditoria', $dark, $mobile);
})->with('audit_modes_parte2');

test('capturas del acceso y los consentimientos', function (bool $dark, bool $mobile) {
    auditShot('/register', 'registro', $dark, $mobile);
    auditShot('/forgot-password', 'recuperar', $dark, $mobile);
    auditShot('/reset-password/token-de-prueba?email=oliver@example.com', 'restablecer', $dark, $mobile);

    $unverified = User::factory()->unverified()->create();
    UserSetting::factory()->for($unverified)->create(['show_mascot' => false, 'locale' => 'es']);
    $this->actingAs($unverified);
    auditShot('/email/verify', 'verificar-email', $dark, $mobile);

    $user = User::factory()->create(['name' => 'Oliver Prueba']);
    UserSetting::factory()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    $this->actingAs($user);
    auditShot('/user/confirm-password', 'confirmar-contrasena', $dark, $mobile);

    $game = gameWithOAuthApp(['name' => 'Daino']);
    auditShot('/play/'.$game->slug, 'consentimiento-juego', $dark, $mobile);

    auditShot('/oauth/authorize?'.http_build_query([
        'client_id' => $game->registeredApp->oauth_client_id,
        'redirect_uri' => 'https://embedded.test/auth/callback',
        'response_type' => 'code',
        'scope' => 'user:read user:email',
        'state' => 'estado-de-prueba',
        'code_challenge' => str_repeat('a', 43),
        'code_challenge_method' => 'S256',
    ]), 'consentimiento-oauth', $dark, $mobile);
})->with('audit_modes_parte2');
