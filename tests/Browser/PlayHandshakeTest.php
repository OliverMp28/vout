<?php

use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\OAuthUserGrant;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Laravel\Passport\Passport;
use Pest\Browser\Api\PendingAwaitablePage;
use Pest\Browser\Api\Webpage;
use Pest\Browser\ServerManager;

// -----------------------------------------------------------------------
// Tests de navegador del handshake portal ↔ juego embebido.
//
// El juego de prueba se sirve desde `http://localhost:{puerto}` mientras el
// portal corre en `http://127.0.0.1:{puerto}`: mismo servidor, pero orígenes
// distintos para el navegador. Es el escenario real de una app del
// ecosistema (iframe cross-origin, sin acceso al DOM entre ventanas), así
// que el juego devuelve lo que recibe al portal con un mensaje `TEST_ECHO`
// —que el handshake ignora por no ser del protocolo— y el test lo lee ahí.
//
// Requiere assets compilados (`vendor/bin/sail bun run build`).
// -----------------------------------------------------------------------

beforeEach(function (): void {
    $this->setUpPassport();

    Route::get('/__embedded-game', fn () => response(<<<'HTML'
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Embedded game stub</title></head>
        <body>
        <script>
            const portalOrigin = new URL(document.referrer).origin;
            const received = [];

            window.addEventListener('message', (event) => {
                if (event.source !== window.parent || event.origin !== portalOrigin) {
                    return;
                }
                if (event.data.type === 'TEST_REQUEST_EXIT') {
                    window.parent.postMessage({ type: 'EXIT' }, portalOrigin);
                    return;
                }
                received.push(event.data);
            });

            // Como un juego real: repite READY hasta que llega VOUT_AUTH.
            (function announce() {
                if (received.some((message) => message.type === 'VOUT_AUTH')) {
                    return;
                }
                window.parent.postMessage({ type: 'READY', suggestedPreset: 'runner' }, portalOrigin);
                setTimeout(announce, 150);
            })();

            setInterval(() => {
                window.parent.postMessage({ type: 'TEST_ECHO', received }, portalOrigin);
            }, 100);
        </script>
        </body>
        </html>
        HTML));

    // El mismo juego, pero integrado como lo haría un desarrollador: con el
    // SDK público (`public/sdk/vout-game.js`) y sus controles de teclado y
    // ratón de siempre.
    Route::get('/__embedded-sdk-game', fn () => response(<<<'HTML'
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Embedded SDK game stub</title></head>
        <body style="margin:0;height:100vh">
        <script src="/sdk/vout-game.js"></script>
        <script>
            const portalOrigin = new URL(document.referrer).origin;
            const log = { auth: [], keys: [], clicks: [], actions: [], sessionEnds: [] };

            for (const type of ['keydown', 'keyup']) {
                document.addEventListener(type, (event) => {
                    log.keys.push({ type, code: event.code, key: event.key, keyCode: event.keyCode, t: Date.now() });
                });
            }
            document.addEventListener('click', (event) => {
                log.clicks.push({
                    x: event.clientX / window.innerWidth,
                    y: event.clientY / window.innerHeight,
                    button: event.button,
                });
            });

            const vout = VoutGame.connect({
                portalOrigin,
                suggestedPreset: 'runner',
                onAuth: (session) => log.auth.push(session),
                onSessionEnd: (reason) => log.sessionEnds.push(reason),
                onAction: (event, at) => log.actions.push({ phase: 'start', event, at }),
                onActionEnd: (event, at) => log.actions.push({ phase: 'end', event, at }),
            });

            window.addEventListener('message', (event) => {
                if (event.origin === portalOrigin && event.data.type === 'TEST_REQUEST_EXIT') {
                    vout.exit();
                }
            });

            setInterval(() => {
                window.parent.postMessage(
                    { type: 'TEST_ECHO', received: [], log, embedded: vout.embedded, hasSession: vout.session !== null },
                    portalOrigin,
                );
            }, 100);
        </script>
        </body>
        </html>
        HTML));
});

/**
 * Origen `http://localhost:{puerto}` del servidor de test: mismo servidor
 * que el portal (`127.0.0.1`), pero otro origen para el navegador.
 */
function embeddedGameOrigin(): string
{
    $port = parse_url(ServerManager::instance()->http()->rewrite('/'), PHP_URL_PORT);

    return 'http://localhost:'.$port;
}

/**
 * Apunta el juego al stub cross-origin y autoriza ese origen.
 */
function embedStubIn(Game $game, string $path = '/__embedded-game'): Game
{
    $origin = embeddedGameOrigin();

    $game->update(['embed_url' => $origin.$path]);
    $game->registeredApp?->update(['allowed_origins' => [$origin]]);

    return $game;
}

/**
 * Espera a que el juego haya recibido al menos `$distinctTokens` tokens
 * distintos por VOUT_AUTH y devuelve esos mensajes (o null si no llegan).
 *
 * @return list<array{type: string, token: string, expiresAt: int, voutId: string, username: string}>|null
 */
function waitForAuthMessages(PendingAwaitablePage|Webpage $page, int $distinctTokens = 1, int $timeoutMs = 8000): ?array
{
    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};
            let latest = [];

            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'TEST_ECHO') {
                    latest = event.data.received.filter((message) => message.type === 'VOUT_AUTH');
                }
            });

            (function poll() {
                if (new Set(latest.map((message) => message.token)).size >= {$distinctTokens}) {
                    return resolve(latest);
                }
                if (Date.now() > deadline) {
                    return resolve(null);
                }
                setTimeout(poll, 100);
            })();
        })
    JS);
}

/**
 * Espera a que el juego reciba un mensaje del tipo indicado y lo devuelve
 * (o null si no llega a tiempo).
 *
 * @return array<string, mixed>|null
 */
function waitForGameMessage(PendingAwaitablePage|Webpage $page, string $type, int $timeoutMs = 8000): ?array
{
    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};
            let found = null;

            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'TEST_ECHO') {
                    found = event.data.received.find((message) => message.type === '{$type}') ?? null;
                }
            });

            (function poll() {
                if (found !== null) {
                    return resolve(found);
                }
                if (Date.now() > deadline) {
                    return resolve(null);
                }
                setTimeout(poll, 100);
            })();
        })
    JS);
}

/**
 * Espera a que el juego integrado con el SDK cumpla una condición sobre lo
 * que ha registrado (`log`) y devuelve su último eco, o null si no llega.
 *
 * @param  string  $condition  Expresión JavaScript sobre `echo` (el mensaje TEST_ECHO).
 * @return array<string, mixed>|null
 */
function waitForSdkEcho(PendingAwaitablePage|Webpage $page, string $condition, int $timeoutMs = 8000): ?array
{
    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};
            let latest = null;

            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'TEST_ECHO') {
                    latest = event.data;
                }
            });

            (function poll() {
                const echo = latest;
                if (echo !== null && ({$condition})) {
                    return resolve(echo);
                }
                if (Date.now() > deadline) {
                    return resolve(null);
                }
                setTimeout(poll, 100);
            })();
        })
    JS);
}

/**
 * Espera un VOUT_AUTH a nombre del usuario indicado, sobreviviendo a una
 * recarga de la página entre medias (que destruye el contexto del script
 * en curso y obliga a reintentar).
 *
 * @return array{type: string, token: string, expiresAt: int, voutId: string, username: string}|null
 */
function waitForAuthAs(PendingAwaitablePage|Webpage $page, string $voutId, int $timeoutMs = 30000): ?array
{
    $deadline = microtime(true) + $timeoutMs / 1000;

    while (microtime(true) < $deadline) {
        try {
            $auths = waitForAuthMessages($page, timeoutMs: 1500) ?? [];
        } catch (Throwable) {
            $auths = [];
        }

        foreach ($auths as $auth) {
            if ($auth['voutId'] === $voutId) {
                return $auth;
            }
        }

        usleep(300_000);
    }

    return null;
}

test('el portal entrega la identidad a un juego de otro origen tras su READY', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user);

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]));

    $page = visit('/play/'.$game->slug);
    $auths = waitForAuthMessages($page);

    expect($auths)->not->toBeNull();

    $auth = $auths[0];
    $payload = decodeJwtSection($auth['token'], 1);

    expect($auth['voutId'])->toBe($user->vout_id)
        ->and($auth['username'])->toBe($user->name)
        ->and($auth['expiresAt'])->toBe((int) floor($payload['exp']))
        ->and($payload['vout_id'])->toBe($user->vout_id)
        ->and($payload['scopes'])->toBe(['game:play']);

    $page->assertNoJavaScriptErrors()
        ->assertSee('runner');

    expect($page->script("document.querySelector('iframe').getAttribute('sandbox')"))
        ->toBe('allow-scripts allow-same-origin allow-orientation-lock')
        ->and($page->script("document.querySelector('iframe').getAttribute('allow')"))
        ->toBe('autoplay; fullscreen; clipboard-write; web-share');
});

test('el portal reenvía un token nuevo antes de que caduque el anterior', function (): void {
    // TTL de 20 s: queda por debajo del margen de renovación, así que el
    // portal renueva en cuanto pasa su espera mínima (~10 s).
    Passport::tokensExpireIn(now()->addSeconds(20));

    $this->actingAs(User::factory()->create());

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]));

    $page = visit('/play/'.$game->slug);
    $auths = waitForAuthMessages($page, distinctTokens: 2, timeoutMs: 20000);

    expect($auths)->not->toBeNull();

    $first = $auths[0];
    $renewed = end($auths);

    expect($renewed['token'])->not->toBe($first['token'])
        ->and($renewed['expiresAt'])->toBeGreaterThan($first['expiresAt'])
        ->and(decodeJwtSection($renewed['token'], 1)['aud'])
        ->toBe(decodeJwtSection($first['token'], 1)['aud']);

    $page->assertNoJavaScriptErrors();
});

test('el portal avisa al juego cuando la sesión deja de renovarse', function (string $expectedReason, Closure $makeGame, Closure $endSession): void {
    Passport::tokensExpireIn(now()->addSeconds(20));

    $user = User::factory()->create();
    $this->actingAs($user);

    visit('/catalog');
    $game = embedStubIn($makeGame($user));

    $page = visit('/play/'.$game->slug);

    expect(waitForAuthMessages($page))->not->toBeNull();

    $endSession($user, $game);

    $message = waitForGameMessage($page, 'VOUT_SESSION_END', timeoutMs: 20000);

    expect($message)->toBe(['type' => 'VOUT_SESSION_END', 'reason' => $expectedReason]);

    $page->assertNoJavaScriptErrors();
})->with([
    'el usuario revoca la app' => [
        'revoked',
        function (User $user): Game {
            $game = gameWithOAuthApp();
            authorizeGameApp($user, $game);

            return $game;
        },
        fn (User $user, Game $game) => OAuthUserGrant::query()->where('user_id', $user->id)->sole()->revoke(),
    ],
    'el juego deja de estar disponible' => [
        'unavailable',
        fn (): Game => Game::factory()->create(['is_active' => true]),
        fn (User $user, Game $game) => $game->update(['is_active' => false]),
    ],
]);

test('si la sesión web pasa a otra cuenta, el portal recarga y el juego recibe la identidad nueva', function (): void {
    Passport::tokensExpireIn(now()->addSeconds(20));

    $firstUser = User::factory()->create();
    $secondUser = User::factory()->create();
    $this->actingAs($firstUser);

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]));

    $page = visit('/play/'.$game->slug);

    expect(waitForAuthAs($page, $firstUser->vout_id, timeoutMs: 8000))->not->toBeNull();

    // Cambio de cuenta "en otra pestaña": la sesión web ya es de otro usuario.
    $this->actingAs($secondUser);

    $auth = waitForAuthAs($page, $secondUser->vout_id);

    expect($auth)->not->toBeNull()
        ->and($auth['username'])->toBe($secondUser->name)
        ->and(decodeJwtSection($auth['token'], 1)['vout_id'])->toBe($secondUser->vout_id);
});

test('EXIT desde el juego devuelve al usuario al catálogo', function (): void {
    $this->actingAs(User::factory()->create());

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]));

    $page = visit('/play/'.$game->slug);

    expect(waitForAuthMessages($page))->not->toBeNull();

    $page->script(<<<'JS'
        (() => {
            const frame = document.querySelector('iframe');
            frame.contentWindow.postMessage({ type: 'TEST_REQUEST_EXIT' }, new URL(frame.src).origin);
        })()
    JS);

    $page->assertPathIs('/catalog')
        ->assertNoJavaScriptErrors();
});

test('una app third-party sin autorizar pasa por el consentimiento y recibe un token para su client', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user);

    visit('/catalog');
    $game = embedStubIn(gameWithOAuthApp(['name' => 'Daino']));
    $clientId = $game->registeredApp->oauth_client_id;

    $page = visit('/play/'.$game->slug);

    $page->assertNoJavaScriptErrors()
        ->assertSee('Daino')
        ->assertSee('user:read')
        ->assertMissing('iframe')
        ->click('#btn-play-consent-approve')
        ->assertPathIs('/play/'.$game->slug);

    $auths = waitForAuthMessages($page);

    expect($auths)->not->toBeNull();

    $payload = decodeJwtSection($auths[0]['token'], 1);

    expect($payload['aud'])->toBe($clientId)
        ->and($payload['scopes'])->toBe(['user:read'])
        ->and($payload['vout_id'])->toBe($user->vout_id)
        ->and(OAuthUserGrant::query()->where('user_id', $user->id)->where('client_id', $clientId)->exists())->toBeTrue();

    $page->assertNoJavaScriptErrors();
});

// ─── SDK público para juegos (`public/sdk/vout-game.js`) ──────────────

test('un juego integrado con el SDK recibe la identidad sin escribir el saludo a mano', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user);

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]), '/__embedded-sdk-game');

    $page = visit('/play/'.$game->slug);
    $echo = waitForSdkEcho($page, 'echo.log.auth.length >= 1');

    expect($echo)->not->toBeNull()
        ->and($echo['embedded'])->toBeTrue()
        ->and($echo['hasSession'])->toBeTrue()
        ->and($echo['log']['auth'][0]['voutId'])->toBe($user->vout_id)
        ->and($echo['log']['auth'][0]['username'])->toBe($user->name)
        ->and(decodeJwtSection($echo['log']['auth'][0]['token'], 1)['vout_id'])->toBe($user->vout_id);

    $page->assertNoJavaScriptErrors()
        ->assertSee('runner');
});

test('el SDK convierte las teclas, clics y acciones del portal en entrada real del juego', function (): void {
    $this->actingAs(User::factory()->create());

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]), '/__embedded-sdk-game');

    $page = visit('/play/'.$game->slug);

    expect(waitForSdkEcho($page, 'echo.log.auth.length >= 1'))->not->toBeNull();

    // Lo que ActionDispatcher envía a un juego de otro origen cuando el
    // usuario hace un gesto mapeado a una tecla, a un clic o a un evento.
    $page->script(<<<'JS'
        (() => {
            const frame = document.querySelector('iframe');
            const origin = new URL(frame.src).origin;
            const send = (message) => frame.contentWindow.postMessage(message, origin);

            send({ type: 'VOUT_KEY', code: 'Space', key: ' ', state: 'down', at: Date.now() });
            send({ type: 'VOUT_KEY', code: 'Space', key: ' ', state: 'up', at: Date.now() });
            send({ type: 'VOUT_CURSOR', x: 0.25, y: 0.5 });
            send({ type: 'VOUT_CLICK', button: 'left', at: Date.now() });
            send({ type: 'VOUT_ACTION', event: 'JUMP', at: 111 });
            send({ type: 'VOUT_ACTION_END', event: 'JUMP', at: 222 });
            send({ type: 'VOUT_ALGO_FUTURO', whatever: true });
        })()
    JS);

    $echo = waitForSdkEcho(
        $page,
        'echo.log.keys.length >= 2 && echo.log.clicks.length >= 1 && echo.log.actions.length >= 2',
    );

    expect($echo)->not->toBeNull();

    [$keyDown, $keyUp] = $echo['log']['keys'];

    expect($keyDown)->toMatchArray(['type' => 'keydown', 'code' => 'Space', 'key' => ' ', 'keyCode' => 32])
        ->and($keyUp)->toMatchArray(['type' => 'keyup', 'code' => 'Space', 'keyCode' => 32])
        ->and($keyUp['t'] - $keyDown['t'])->toBeGreaterThanOrEqual(70)
        ->and($echo['log']['keys'])->toHaveCount(2)
        ->and($echo['log']['clicks'][0]['button'])->toBe(0)
        ->and(abs($echo['log']['clicks'][0]['x'] - 0.25))->toBeLessThan(0.02)
        ->and(abs($echo['log']['clicks'][0]['y'] - 0.5))->toBeLessThan(0.02)
        ->and($echo['log']['actions'])->toBe([
            ['phase' => 'start', 'event' => 'JUMP', 'at' => 111],
            ['phase' => 'end', 'event' => 'JUMP', 'at' => 222],
        ]);

    $page->assertNoJavaScriptErrors();
});

test('con el SDK, vout.exit() devuelve al usuario al catálogo', function (): void {
    $this->actingAs(User::factory()->create());

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]), '/__embedded-sdk-game');

    $page = visit('/play/'.$game->slug);

    expect(waitForSdkEcho($page, 'echo.log.auth.length >= 1'))->not->toBeNull();

    $page->script(<<<'JS'
        (() => {
            const frame = document.querySelector('iframe');
            frame.contentWindow.postMessage({ type: 'TEST_REQUEST_EXIT' }, new URL(frame.src).origin);
        })()
    JS);

    $page->assertPathIs('/catalog');
});

// ─── Cámara ───────────────────────────────────────────────────────────

test('si la cámara no se puede abrir, el panel lo explica y el juego sigue disponible', function (): void {
    $user = User::factory()->create();
    GestureConfig::factory()->for($user)->create(['is_active' => true]);
    $this->actingAs($user);

    visit('/catalog');
    $game = embedStubIn(Game::factory()->create(['is_active' => true]));

    // El navegador de pruebas no tiene cámara: activar el control facial
    // falla, y eso no puede quedar en silencio ni tapar el juego.
    $page = visit('/play/'.$game->slug);

    expect(waitForAuthMessages($page))->not->toBeNull();

    $page->click('#play-engine-toggle')
        ->assertVisible('aside [data-slot="alert"]')
        ->assertVisible('#play-engine-toggle')
        ->assertNoJavaScriptErrors();
});
