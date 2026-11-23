<?php

use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Support\Facades\Route;
use Pest\Browser\Api\PendingAwaitablePage;
use Pest\Browser\Api\Webpage;
use Pest\Browser\ServerManager;

// -----------------------------------------------------------------------
// Motor de gestos real (worker + MediaPipe) en la página de juego.
//
// El navegador de pruebas no tiene cámara: se sustituye `getUserMedia` por
// un lienzo animado (`canvas.captureStream`). No hay cara en la imagen, así
// que no se detectan gestos, pero todo el camino se ejecuta de verdad:
// carga de MediaPipe desde Vout, envío de fotogramas con control de flujo,
// inferencia y telemetría.
//
// Requiere assets compilados (`vendor/bin/sail bun run build`).
// -----------------------------------------------------------------------

beforeEach(function (): void {
    // La página de juego emite el token de sesión con Passport.
    $this->setUpPassport();

    Route::get('/__engine-game', fn () => response(
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Engine stub</title></head><body></body></html>',
    ));

    // Como un juego real: repite READY hasta que llega VOUT_AUTH, así que el
    // handshake termina y el portal da el juego por cargado.
    Route::get('/__engine-ready-game', fn () => response(<<<'HTML'
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Engine stub (ready)</title></head>
        <body>
        <script>
            const portalOrigin = new URL(document.referrer).origin;
            let authenticated = false;

            window.addEventListener('message', (event) => {
                if (event.source === window.parent && event.data?.type === 'VOUT_AUTH') {
                    authenticated = true;
                }
            });

            (function announce() {
                if (authenticated) {
                    return;
                }
                window.parent.postMessage({ type: 'READY' }, portalOrigin);
                setTimeout(announce, 150);
            })();
        </script>
        </body>
        </html>
        HTML));
});

/**
 * Juego activo que embebe una página del propio servidor de test (sin salir a
 * internet) y un usuario con perfil de gestos, ya autenticado.
 *
 * @param  bool  $gesturesEnabled  El usuario tiene el control facial activado en Ajustes.
 * @param  bool  $announcesReady  El juego hace el handshake (si no, nunca termina de cargar).
 */
function engineTestGame(bool $gesturesEnabled = false, bool $announcesReady = false): Game
{
    $user = User::factory()->create();
    GestureConfig::factory()->for($user)->create(['is_active' => true]);

    if ($gesturesEnabled) {
        UserSetting::factory()->withGestures()->for($user)->create(['show_mascot' => false]);
    }

    test()->actingAs($user);

    $port = parse_url(ServerManager::instance()->http()->rewrite('/'), PHP_URL_PORT);

    return Game::factory()->create([
        'is_active' => true,
        'embed_url' => 'http://localhost:'.$port.($announcesReady ? '/__engine-ready-game' : '/__engine-game'),
    ]);
}

/**
 * Espera a que `#game-frame` tenga `data-{$attribute}` con uno de `$values` y
 * devuelve el valor en que se quedó.
 *
 * @param  list<string>  $values
 */
function waitForGameFrame(PendingAwaitablePage|Webpage $page, string $attribute, array $values, int $timeoutMs = 60000): ?string
{
    $expected = json_encode($values);

    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};

            (function poll() {
                const current = document.querySelector('#game-frame')?.dataset.{$attribute} ?? null;

                if ({$expected}.includes(current) || Date.now() > deadline) {
                    return resolve(current);
                }

                setTimeout(poll, 100);
            })();
        })
    JS);
}

/** Espera a que aparezca `$selector` (o desaparezca, con `$present = false`). */
function waitForSelector(PendingAwaitablePage|Webpage $page, string $selector, bool $present = true, int $timeoutMs = 20000): bool
{
    $selectorJson = json_encode($selector);
    $presentJs = $present ? 'true' : 'false';

    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};

            (function poll() {
                const found = document.querySelector({$selectorJson}) !== null;

                if (found === {$presentJs}) {
                    return resolve(true);
                }

                if (Date.now() > deadline) {
                    return resolve(false);
                }

                setTimeout(poll, 100);
            })();
        })
    JS);
}

/**
 * Con la telemetría abierta (Ctrl+M), espera a que la fila `$name` muestre uno
 * de `$values` y devuelve lo que muestra.
 *
 * @param  list<string>  $values
 */
function waitForTelemetryInfo(PendingAwaitablePage|Webpage $page, string $name, array $values, int $timeoutMs = 20000): ?string
{
    $expected = json_encode($values);

    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};

            (function poll() {
                const value = document.querySelector('[data-telemetry-info="{$name}"]')?.dataset.value ?? null;

                if ({$expected}.includes(value) || Date.now() > deadline) {
                    return resolve(value);
                }

                setTimeout(poll, 200);
            })();
        })
    JS);
}

/** Con la telemetría abierta, espera a que haya muestras de `$metric`. */
function waitForTelemetryMetric(PendingAwaitablePage|Webpage $page, string $metric, int $timeoutMs = 20000): bool
{
    return waitForSelector($page, '[data-telemetry-metric="'.$metric.'"]', true, $timeoutMs);
}

function toggleTelemetry(PendingAwaitablePage|Webpage $page): void
{
    $page->script("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true }))");
}

/** Ficheros de MediaPipe que la página ha pedido a la caché por adelantado. */
function prefetchedRuntimeFiles(PendingAwaitablePage|Webpage $page): array
{
    return $page->script(<<<'JS'
        Array.from(document.querySelectorAll('link[rel="prefetch"][data-mediapipe-prefetch]'))
            .map((link) => link.href)
    JS);
}

/**
 * Sustituye la cámara por un lienzo que cambia `$fps` veces por segundo y
 * guarda en `window.__engineInit` el mensaje INIT que recibe el worker.
 */
function useSyntheticCamera(PendingAwaitablePage|Webpage $page, int $fps): void
{
    $page->script(<<<JS
        (() => {
            const fps = {$fps};
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const context = canvas.getContext('2d');
            let tick = 0;

            const paint = () => {
                tick++;
                context.fillStyle = 'hsl(' + ((tick * 37) % 360) + ' 60% 45%)';
                context.fillRect(0, 0, canvas.width, canvas.height);
            };

            paint();
            setInterval(paint, 1000 / fps);

            navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(fps);
            navigator.mediaDevices.enumerateDevices = async () => [{
                kind: 'videoinput',
                deviceId: 'synthetic',
                groupId: 'synthetic',
                label: 'Synthetic camera',
                toJSON() { return this; },
            }];

            const NativeWorker = window.Worker;
            window.Worker = class extends NativeWorker {
                postMessage(message, transfer) {
                    if (message && message.type === 'INIT') {
                        window.__engineInit = message;
                    }

                    return super.postMessage(message, transfer);
                }
            };
        })()
    JS);
}

/** `esquema://host[:puerto]` de una URL, como `location.origin`. */
function originOf(string $url): string
{
    $port = parse_url($url, PHP_URL_PORT);

    return parse_url($url, PHP_URL_SCHEME).'://'.parse_url($url, PHP_URL_HOST).($port === null ? '' : ':'.$port);
}

/**
 * Espera a que el motor llegue a `$status` y devuelve el estado en que se
 * quedó (para que un fallo diga cuál fue).
 */
function waitForEngineStatus(PendingAwaitablePage|Webpage $page, string $status, int $timeoutMs = 60000): ?string
{
    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};

            (function poll() {
                const current = document.querySelector('#game-frame')?.dataset.engineStatus ?? null;

                if (current === '{$status}' || current === 'error' || Date.now() > deadline) {
                    return resolve(current);
                }

                setTimeout(poll, 200);
            })();
        })
    JS);
}

/**
 * Abre la telemetría (Ctrl+M) y devuelve lo que muestra cuando hay datos:
 * `info` (versión, delegado…) y `p50` por métrica.
 *
 * @return array{info: array<string, string>, p50: array<string, float>}|null
 */
function readEngineTelemetry(PendingAwaitablePage|Webpage $page, int $timeoutMs = 20000): ?array
{
    return $page->script(<<<JS
        new Promise((resolve) => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true }));

            const deadline = Date.now() + {$timeoutMs};

            (function poll() {
                const info = {};
                const p50 = {};

                document.querySelectorAll('[data-telemetry-info]').forEach((row) => {
                    info[row.dataset.telemetryInfo] = row.dataset.value;
                });
                document.querySelectorAll('[data-telemetry-metric]').forEach((row) => {
                    p50[row.dataset.telemetryMetric] = Number(row.dataset.p50);
                });

                if (Number(info.framesSent ?? 0) >= 5 && 'queueMs' in p50) {
                    return resolve({ info, p50 });
                }

                if (Date.now() > deadline) {
                    return resolve(null);
                }

                setTimeout(poll, 250);
            })();
        })
    JS);
}

test('el motor carga MediaPipe desde Vout y analiza la cámara sin cola de fotogramas', function (): void {
    $game = engineTestGame();
    $mediapipeVersion = json_decode(
        file_get_contents(base_path('node_modules/@mediapipe/tasks-vision/package.json')),
        true,
    )['version'];

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    // Todo lo que descarga el worker es del propio portal (o, con
    // `bun run dev`, del dev server de Vite).
    $init = $page->script('window.__engineInit');
    $ownOrigins = [$page->script('location.origin')];

    if (file_exists(public_path('hot'))) {
        $ownOrigins[] = trim(file_get_contents(public_path('hot')));
    }

    $urls = [
        $init['assets']['visionBundleUrl'],
        $init['assets']['modelUrl'],
        ...array_values($init['assets']['wasm']['simd']),
        ...array_values($init['assets']['wasm']['nosimd']),
    ];

    foreach ($urls as $url) {
        expect(originOf($url))->toBeIn($ownOrigins);
    }

    expect($init['mediapipeVersion'])->toBe($mediapipeVersion);

    $thirdParty = $page->script(<<<'JS'
        performance.getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => /cdn\.jsdelivr\.net|storage\.googleapis\.com/.test(name))
    JS);

    expect($thirdParty)->toBe([]);

    $telemetry = readEngineTelemetry($page);

    expect($telemetry)->not->toBeNull()
        ->and($telemetry['info']['mediapipe'])->toBe($mediapipeVersion)
        ->and($telemetry['info']['delegate'])->toBeIn(['GPU', 'CPU'])
        ->and($telemetry['info']['frameSource'])->toBeIn(['video-frame-callback', 'polling'])
        ->and($telemetry['p50'])->toHaveKeys(['inferenceMs', 'captureMs', 'returnMs', 'pipelineMs'])
        // Con un solo fotograma en vuelo, el worker está libre cuando llega
        // cada uno: no espera en cola detrás de otros.
        ->and($telemetry['p50']['queueMs'])->toBeLessThan(50);

    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'idle'))->toBe('idle');

    $page->assertNoJavaScriptErrors();
});

test('con una cámara lenta el panel avisa de que con más luz los gestos responden antes', function (): void {
    $game = engineTestGame();

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 8);
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    $page->assertVisible('[data-camera-notice="low_fps"]')
        ->assertSeeIn('[data-camera-notice="low_fps"]', 'fps')
        ->assertNoJavaScriptErrors();
});

/**
 * Espera a que el panel muestre la calibración en `$state` y devuelve el
 * motivo del fallo (o `$state` si no es un fallo), o null si no llega.
 */
function waitForCalibration(PendingAwaitablePage|Webpage $page, string $state, int $timeoutMs = 40000): ?string
{
    return $page->script(<<<JS
        new Promise((resolve) => {
            const deadline = Date.now() + {$timeoutMs};

            (function poll() {
                const element = document.querySelector('aside [data-calibration="{$state}"]');

                if (element) {
                    return resolve(element.dataset.calibrationReason ?? '{$state}');
                }

                if (Date.now() > deadline) {
                    return resolve(null);
                }

                setTimeout(poll, 200);
            })();
        })
    JS);
}

test('al arrancar calibra la cara sola y, si no la ve, explica por qué', function (): void {
    $game = engineTestGame();

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    // La cámara sintética no tiene cara: la calibración automática no puede
    // terminar y lo dice, sin bloquear el juego.
    expect(waitForCalibration($page, 'failed'))->toBe('no_face');

    // "Centrar cursor" ya no recalibra.
    $page->click('#play-recenter');

    expect($page->script('document.querySelector(\'aside [data-calibration="calibrating"]\') === null'))->toBeTrue();

    // "Recalibrar cara" vuelve a intentarlo.
    $page->click('#play-calibrate');

    expect(waitForCalibration($page, 'calibrating', 5000))->toBe('calibrating');

    $page->assertNoJavaScriptErrors();
});

// -----------------------------------------------------------------------
// Precarga (motor cargado separado de la sesión)
// -----------------------------------------------------------------------

test('con el control facial activado, el motor se prepara al cargar el juego y reactivar no lo recarga', function (): void {
    $game = engineTestGame(gesturesEnabled: true, announcesReady: true);

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);

    // Sin pulsar nada: primero el juego, después el motor (sin cámara).
    expect(waitForGameFrame($page, 'handshakeStatus', ['authenticated']))->toBe('authenticated')
        ->and(waitForGameFrame($page, 'engineRuntime', ['loading', 'ready']))->toBeIn(['loading', 'ready']);

    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    toggleTelemetry($page);

    // La activación encontró el motor preparándose o ya listo.
    expect(waitForTelemetryInfo($page, 'runtime', ['warm', 'warming']))->toBeIn(['warm', 'warming']);

    // Parar apaga la cámara y cierra la sesión, pero el motor sigue cargado.
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'idle'))->toBe('idle')
        ->and(waitForGameFrame($page, 'engineRuntime', ['ready']))->toBe('ready');

    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running')
        ->and(waitForTelemetryInfo($page, 'runtime', ['warm']))->toBe('warm')
        ->and(waitForTelemetryMetric($page, 'engineStartMs'))->toBeTrue();

    $page->assertNoJavaScriptErrors();
});

test('sin el control facial activado en Ajustes no se prepara nada hasta pulsar', function (): void {
    $game = engineTestGame(gesturesEnabled: false, announcesReady: true);

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);

    expect(waitForGameFrame($page, 'handshakeStatus', ['authenticated']))->toBe('authenticated');

    // Más que el tiempo que esperaría la precarga (navegador libre, 2 s).
    $page->script('new Promise((resolve) => setTimeout(resolve, 3000))');

    expect($page->script('document.querySelector("#game-frame").dataset.engineRuntime'))->toBe('none')
        ->and($page->script('window.__engineInit === undefined'))->toBeTrue();

    // Activar sigue funcionando: el motor se carga al pulsar.
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    $page->assertNoJavaScriptErrors();
});

test('la vista de la cámara se enciende en el panel y la dibuja el worker', function (): void {
    $game = engineTestGame();

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running')
        // Apagada por defecto.
        ->and($page->script('document.querySelector("aside [data-face-mesh] canvas") === null'))->toBeTrue();

    $page->click('#play-preview-toggle');

    expect(waitForSelector($page, 'aside [data-face-mesh="synced"] canvas'))->toBeTrue();

    toggleTelemetry($page);

    // El worker dibuja cada fotograma (la cámara sintética no tiene cara: la
    // imagen sola) y dice cuánto tarda.
    expect(waitForTelemetryMetric($page, 'previewMs'))->toBeTrue();

    $page->click('#play-preview-toggle');

    expect(waitForSelector($page, 'aside [data-face-mesh] canvas', present: false))->toBeTrue();

    $page->assertNoJavaScriptErrors();
});

test('en la ficha del juego, quien usa el control facial descarga ya los ficheros del motor', function (): void {
    $game = engineTestGame(gesturesEnabled: true);

    $page = visit('/catalog/'.$game->slug);

    $page->script('new Promise((resolve) => setTimeout(resolve, 3000))');

    $files = prefetchedRuntimeFiles($page);

    expect($files)->toHaveCount(4)
        ->and(implode(' ', $files))->toContain('vision_wasm_internal')
        ->and(implode(' ', $files))->toContain('face_landmarker');

    $page->assertNoJavaScriptErrors();
});

test('en la ficha del juego, sin el control facial no se descarga nada', function (): void {
    $game = engineTestGame(gesturesEnabled: false);

    $page = visit('/catalog/'.$game->slug);

    $page->script('new Promise((resolve) => setTimeout(resolve, 3000))');

    expect(prefetchedRuntimeFiles($page))->toBe([]);

    $page->assertNoJavaScriptErrors();
});

test('el asistente de calibración muestra la malla sobre el vídeo', function (): void {
    $user = User::factory()->create();
    UserSetting::factory()->withGestures()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    $this->actingAs($user);

    $page = visit('/settings/appearance');

    useSyntheticCamera($page, 30);
    $page->click('Activar cámara');

    // En el paso de la cara neutra arranca el motor y la malla se superpone.
    expect(waitForSelector($page, '[data-face-mesh="overlay"] canvas', true, 60000))->toBeTrue();

    $page->assertNoJavaScriptErrors();
});
