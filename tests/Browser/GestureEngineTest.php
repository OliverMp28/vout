<?php

use App\Models\User;
use App\Models\UserSetting;

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

    registerEngineGameRoutes();
});

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

test('quien usa la cámara a veces tiene el motor preparado al cargar el juego y reactivar no lo recarga', function (): void {
    $game = engineTestGame(usage: 'occasional', announcesReady: true);

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

test('quien no usa la cámara no prepara nada hasta pulsar', function (): void {
    $game = engineTestGame(announcesReady: true);

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
    $game = engineTestGame(usage: 'occasional');

    $page = visit('/catalog/'.$game->slug);

    $page->script('new Promise((resolve) => setTimeout(resolve, 3000))');

    $files = prefetchedRuntimeFiles($page);

    expect($files)->toHaveCount(4)
        ->and(implode(' ', $files))->toContain('vision_wasm_internal')
        ->and(implode(' ', $files))->toContain('face_landmarker');

    $page->assertNoJavaScriptErrors();
});

test('en la ficha del juego, sin el control facial no se descarga nada', function (): void {
    $game = engineTestGame();

    $page = visit('/catalog/'.$game->slug);

    $page->script('new Promise((resolve) => setTimeout(resolve, 3000))');

    expect(prefetchedRuntimeFiles($page))->toBe([]);

    $page->assertNoJavaScriptErrors();
});

test('en la ficha de un juego que no admite el control facial no se descarga nada', function (): void {
    $game = engineTestGame(usage: 'primary', support: 'none');

    $page = visit('/catalog/'.$game->slug);

    $page->script('new Promise((resolve) => setTimeout(resolve, 3000))');

    expect(prefetchedRuntimeFiles($page))->toBe([]);

    $page->assertNoJavaScriptErrors();
});

test('en la ficha del juego, quien juega con la cámara ya deja el motor preparado', function (): void {
    $game = engineTestGame(usage: 'primary');

    // Se entra a la ficha desde el catálogo (navegación de Inertia, la
    // ventana es la misma): así el worker queda interceptado antes de que
    // la ficha lo cree.
    $page = visit('/catalog');

    useSyntheticCamera($page, 30);
    $page->click('a[href$="/catalog/'.$game->slug.'"]');

    $prepared = $page->script(<<<'JS'
        new Promise((resolve) => {
            const deadline = Date.now() + 30000;

            (function poll() {
                if (window.__engineInit !== undefined || Date.now() > deadline) {
                    return resolve(window.__engineInit !== undefined);
                }

                setTimeout(poll, 100);
            })();
        })
    JS);

    expect($prepared)->toBeTrue()
        // Sin cámara: prepararlo no la abre.
        ->and($page->script('document.querySelector("video")?.srcObject ?? null'))->toBeNull();

    $page->assertNoJavaScriptErrors();
});

test('el asistente de calibración muestra la malla sobre el vídeo', function (): void {
    $user = User::factory()->create();
    UserSetting::factory()->occasionalCamera()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    $this->actingAs($user);

    $page = visit('/settings/appearance');

    useSyntheticCamera($page, 30);
    $page->click('Activar cámara');

    // En el paso de la cara neutra arranca el motor y la malla se superpone.
    expect(waitForSelector($page, '[data-face-mesh="overlay"] canvas', true, 60000))->toBeTrue();

    $page->assertNoJavaScriptErrors();
});
