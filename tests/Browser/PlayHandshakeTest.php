<?php

use App\Models\Game;
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
function embedStubIn(Game $game): Game
{
    $origin = embeddedGameOrigin();

    $game->update(['embed_url' => $origin.'/__embedded-game']);
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
