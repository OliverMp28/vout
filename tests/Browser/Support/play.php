<?php

/*
 * Helpers de los tests de navegador de la página de juego y del motor de
 * gestos (GestureEngineTest, PlayPageTest…): juegos de prueba servidos por
 * el propio servidor de test, cámara sintética y esperas sobre los `data-*`
 * de `#game-frame`.
 */

use App\Models\Game;
use App\Models\GestureConfig;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Support\Facades\Route;
use Pest\Browser\Api\PendingAwaitablePage;
use Pest\Browser\Api\Webpage;
use Pest\Browser\ServerManager;

/**
 * Registra los juegos de prueba: `/__engine-game` (nunca termina de cargar),
 * `/__engine-ready-game` (hace el handshake como un juego real) y
 * `/__engine-preset-game` (además sugiere sus controles, `runner`).
 */
function registerEngineGameRoutes(): void
{
    Route::get('/__engine-game', fn () => response(
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Engine stub</title></head><body></body></html>',
    ));

    // Como un juego real: repite READY hasta que el portal responde (VOUT_AUTH
    // o VOUT_GUEST), así que el handshake termina y el portal da el juego por
    // cargado.
    Route::get('/__engine-ready-game', fn () => response(<<<'HTML'
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Engine stub (ready)</title></head>
        <body>
        <script>
            const portalOrigin = new URL(document.referrer).origin;
            let authenticated = false;

            window.addEventListener('message', (event) => {
                if (event.source === window.parent && (event.data?.type === 'VOUT_AUTH' || event.data?.type === 'VOUT_GUEST')) {
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

    // Como el anterior, pero sugiere sus controles (`suggestedPreset`).
    Route::get('/__engine-preset-game', fn () => response(<<<'HTML'
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Engine stub (preset)</title></head>
        <body>
        <script>
            const portalOrigin = new URL(document.referrer).origin;
            let authenticated = false;

            window.addEventListener('message', (event) => {
                if (event.source === window.parent && (event.data?.type === 'VOUT_AUTH' || event.data?.type === 'VOUT_GUEST')) {
                    authenticated = true;
                }
            });

            (function announce() {
                if (authenticated) {
                    return;
                }
                window.parent.postMessage({ type: 'READY', suggestedPreset: 'runner' }, portalOrigin);
                setTimeout(announce, 150);
            })();
        </script>
        </body>
        </html>
        HTML));
}

/**
 * Juego activo que embebe una página del propio servidor de test (sin salir a
 * internet) y un usuario con perfil de gestos, ya autenticado.
 *
 * @param  string|null  $usage  Perfil de uso del control facial en Ajustes (`off`, `occasional`, `primary`); null es `off`.
 * @param  bool  $announcesReady  El juego hace el handshake (si no, nunca termina de cargar).
 * @param  string  $support  Si el juego admite el control facial (`none`, `compatible`, `designed`).
 * @param  bool|null  $panelOpen  Cómo dejó el usuario el panel de control facial (null: según el perfil).
 * @param  bool  $withProfile  El usuario tiene un perfil de gestos guardado.
 * @param  bool  $suggestsPreset  El juego hace el handshake y sugiere sus controles (`runner`).
 * @param  bool  $autostart  El usuario autorizó que la cámara se encienda sola.
 */
function engineTestGame(
    ?string $usage = null,
    bool $announcesReady = false,
    string $support = 'compatible',
    ?bool $panelOpen = true,
    bool $withProfile = true,
    bool $suggestsPreset = false,
    bool $autostart = false,
): Game {
    $user = User::factory()->create();

    if ($withProfile) {
        GestureConfig::factory()->for($user)->create(['is_active' => true]);
    }

    UserSetting::factory()->for($user)->create([
        'show_mascot' => false,
        'locale' => 'es',
        'facial_control_usage' => $usage ?? 'off',
        'play_panel_open' => $panelOpen,
        'camera_autostart' => $autostart,
    ]);

    test()->actingAs($user);

    $port = parse_url(ServerManager::instance()->http()->rewrite('/'), PHP_URL_PORT);

    return Game::factory()->create([
        'is_active' => true,
        'facial_control_support' => $support,
        'embed_url' => 'http://localhost:'.$port.match (true) {
            $suggestsPreset => '/__engine-preset-game',
            $announcesReady => '/__engine-ready-game',
            default => '/__engine-game',
        },
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

/**
 * Espera a que `$check` devuelva true (comprobaciones en la base de datos de
 * lo que la página guarda por su cuenta, sin recargar).
 */
function waitUntil(callable $check, int $timeoutMs = 10000): bool
{
    $deadline = microtime(true) + $timeoutMs / 1000;

    while (microtime(true) < $deadline) {
        if ($check()) {
            return true;
        }

        usleep(100_000);
    }

    return (bool) $check();
}

/** Simula que la pestaña se oculta (`true`) o vuelve a verse. */
function setTabHidden(PendingAwaitablePage|Webpage $page, bool $hidden): void
{
    $state = $hidden ? 'hidden' : 'visible';

    $page->script(<<<JS
        (() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => '{$state}' });
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => '{$state}' === 'hidden' });
            document.dispatchEvent(new Event('visibilitychange'));
        })()
    JS);
}

/** Espera `$ms` milisegundos en el navegador. */
function pauseFor(PendingAwaitablePage|Webpage $page, int $ms): void
{
    $page->script("new Promise((resolve) => setTimeout(resolve, {$ms}))");
}
