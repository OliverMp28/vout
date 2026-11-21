<?php

use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\User;
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
});

/**
 * Juego activo que embebe una página vacía del propio servidor de test (sin
 * salir a internet) y un usuario con perfil de gestos, ya autenticado.
 */
function engineTestGame(): Game
{
    $user = User::factory()->create();
    GestureConfig::factory()->for($user)->create(['is_active' => true]);
    test()->actingAs($user);

    $port = parse_url(ServerManager::instance()->http()->rewrite('/'), PHP_URL_PORT);

    return Game::factory()->create([
        'is_active' => true,
        'embed_url' => 'http://localhost:'.$port.'/__engine-game',
    ]);
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
