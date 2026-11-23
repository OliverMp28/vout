<?php

use App\Models\User;

// -----------------------------------------------------------------------
// La página de juego "el juego primero": el control facial solo en juegos
// que lo admiten, detrás del botón "Control facial", con el panel abierto
// o cerrado según el perfil de uso y recordado por cuenta; la prueba sin
// perfil, los controles del juego recordados y la cámara siempre visible
// cuando está encendida.
// -----------------------------------------------------------------------

beforeEach(function (): void {
    // La página de juego emite el token de sesión con Passport.
    $this->setUpPassport();

    registerEngineGameRoutes();
});

function currentUser(): User
{
    return User::query()->latest('id')->firstOrFail();
}

test('un juego que no admite el control facial no ofrece la cámara', function (): void {
    $game = engineTestGame(usage: 'occasional', announcesReady: true, support: 'none');

    $page = visit('/play/'.$game->slug);

    expect(waitForGameFrame($page, 'handshakeStatus', ['authenticated']))->toBe('authenticated');

    $page->script('new Promise((resolve) => setTimeout(resolve, 3000))');

    $page->assertMissing('#play-panel-trigger')
        ->assertMissing('#play-engine-toggle')
        ->assertMissing('aside')
        // A quien usa la cámara se le dice por qué no está.
        ->assertVisible('#play-facial-control-unsupported')
        ->assertNoJavaScriptErrors();

    // Ni siquiera se prepara el motor.
    expect($page->script('document.querySelector("#game-frame").dataset.engineRuntime'))->toBe('none');
});

test('quien usa la cámara a veces tiene el panel cerrado, y se recuerda cómo lo deja', function (): void {
    $game = engineTestGame(usage: 'occasional', panelOpen: null);

    $page = visit('/play/'.$game->slug);

    $page->assertVisible('#play-panel-trigger')
        ->assertMissing('#play-control-panel')
        ->assertAttribute('#play-panel-trigger', 'aria-expanded', 'false');

    $page->click('#play-panel-trigger');

    $page->assertVisible('#play-control-panel')
        ->assertVisible('#play-engine-toggle')
        ->assertAttribute('#play-panel-trigger', 'aria-expanded', 'true');

    expect(waitUntil(fn () => currentUser()->settings()->first()->play_panel_open === true))->toBeTrue();

    // El servidor de test atiende las peticiones en este mismo proceso: el
    // usuario autenticado guarda en memoria los ajustes de la primera visita.
    $this->actingAs(currentUser());

    $page = visit('/play/'.$game->slug);

    $page->assertVisible('#play-control-panel')
        ->assertNoJavaScriptErrors();
});

test('quien juega con la cámara tiene el panel abierto y un "Activar cámara" a mano', function (): void {
    $game = engineTestGame(usage: 'primary', panelOpen: null);

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);

    $page->assertVisible('#play-control-panel')
        ->assertVisible('#play-camera-start')
        ->click('#play-camera-start');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    // Con la cámara encendida, la cabecera lo dice y deja apagarla.
    $page->assertVisible('#play-camera-status')
        ->click('#play-camera-stop');

    expect(waitForEngineStatus($page, 'idle'))->toBe('idle');

    $page->assertNoJavaScriptErrors();
});

test('sin perfil de gestos se puede probar ya, sin configurar nada', function (): void {
    $game = engineTestGame(withProfile: false);

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);

    $page->assertSeeIn('#play-engine-toggle', 'Probar ahora')
        ->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    // Se dice que es una prueba y cómo guardarlo.
    $page->assertVisible('[data-play-trial]')
        ->assertNoJavaScriptErrors();

    expect(currentUser()->gestureConfigs()->count())->toBe(0);
});

test('los controles que sugiere el juego se preguntan una vez y se recuerdan', function (): void {
    $game = engineTestGame(usage: 'occasional', suggestsPreset: true);

    $page = visit('/play/'.$game->slug);

    expect(waitForGameFrame($page, 'handshakeStatus', ['authenticated']))->toBe('authenticated')
        ->and(waitForSelector($page, '#play-preset-choice[data-preset-ask="true"]'))->toBeTrue();

    $page->click('#play-preset-use-game');

    expect(waitForGameFrame($page, 'presetChoice', ['runner']))->toBe('runner')
        ->and(waitUntil(fn () => currentUser()->games()->where('games.id', $game->id)->first()?->pivot->gesture_preset_choice === 'runner'))->toBeTrue();

    // En la partida siguiente no se pregunta: se usan los del juego.
    $page = visit('/play/'.$game->slug);

    expect(waitForGameFrame($page, 'handshakeStatus', ['authenticated']))->toBe('authenticated')
        ->and(waitForSelector($page, '#play-preset-choice[data-preset-ask="false"]'))->toBeTrue()
        ->and(waitForGameFrame($page, 'presetChoice', ['runner']))->toBe('runner');

    $page->assertNoJavaScriptErrors();
});

test('ver la cámara se recuerda y, con el panel cerrado, va en miniatura sobre el juego', function (): void {
    $game = engineTestGame(usage: 'occasional');

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    $page->click('#play-preview-toggle');

    expect(waitForSelector($page, 'aside [data-face-mesh] canvas'))->toBeTrue()
        ->and(waitUntil(fn () => currentUser()->settings()->first()->show_camera_preview === true))->toBeTrue();

    // Al cerrar el panel la cámara pasa a la miniatura.
    $page->click('#play-panel-trigger');

    expect(waitForSelector($page, '#play-camera-thumbnail [data-face-mesh] canvas'))->toBeTrue();

    $page->click('#play-camera-thumbnail-hide');

    expect(waitForSelector($page, '#play-camera-thumbnail', present: false))->toBeTrue()
        ->and(waitUntil(fn () => currentUser()->settings()->first()->show_camera_preview === false))->toBeTrue();

    $page->assertNoJavaScriptErrors();
});

// ─── Encendido automático ─────────────────────────────────────────────

test('con el encendido automático y el permiso dado, avisa 3 s y enciende la cámara sola', function (): void {
    $game = engineTestGame(usage: 'primary', announcesReady: true, panelOpen: null, autostart: true);

    $page = visit('/play/'.$game->slug, ['permissions' => ['camera']]);

    useSyntheticCamera($page, 30);

    expect(waitForSelector($page, '#play-stage-notice[data-notice="countdown"]'))->toBeTrue()
        // Mientras avisa, la cámara sigue apagada.
        ->and($page->script('document.querySelector("#game-frame").dataset.engineStatus'))->toBe('idle')
        ->and(waitForEngineStatus($page, 'running'))->toBe('running')
        ->and(waitForSelector($page, '#play-stage-notice', present: false))->toBeTrue();

    $page->assertVisible('#play-camera-status')
        ->assertNoJavaScriptErrors();
});

test('"Ahora no" deja la cámara apagada en esta visita', function (): void {
    $game = engineTestGame(usage: 'primary', announcesReady: true, panelOpen: null, autostart: true);

    $page = visit('/play/'.$game->slug, ['permissions' => ['camera']]);

    useSyntheticCamera($page, 30);

    expect(waitForSelector($page, '#play-autostart-cancel'))->toBeTrue();

    $page->click('#play-autostart-cancel');
    pauseFor($page, 4000);

    expect($page->script('document.querySelector("#game-frame").dataset.engineStatus'))->toBe('idle');

    $page->assertMissing('#play-stage-notice')
        ->assertNoJavaScriptErrors();
});

test('sin permiso del navegador no se enciende sola: lo explica y deja el botón a mano', function (): void {
    $game = engineTestGame(usage: 'primary', announcesReady: true, panelOpen: null, autostart: true);

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);

    expect(waitForSelector($page, '#play-stage-notice[data-notice="ask"]'))->toBeTrue()
        // Para quien no usa el ratón: basta Enter.
        ->and($page->script('document.activeElement?.id ?? null'))->toBe('play-stage-notice-activate');

    pauseFor($page, 4000);

    expect($page->script('document.querySelector("#game-frame").dataset.engineStatus'))->toBe('idle');

    $page->click('#play-stage-notice-activate');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    $page->assertNoJavaScriptErrors();
});

test('quien no juega con la cámara no la tiene en automático', function (): void {
    $game = engineTestGame(usage: 'occasional', announcesReady: true, autostart: true);

    $page = visit('/play/'.$game->slug, ['permissions' => ['camera']]);

    expect(waitForGameFrame($page, 'handshakeStatus', ['authenticated']))->toBe('authenticated');

    pauseFor($page, 4000);

    $page->assertMissing('#play-stage-notice')
        ->assertNoJavaScriptErrors();

    expect($page->script('document.querySelector("#game-frame").dataset.engineStatus'))->toBe('idle');
});

// ─── Pestaña oculta y pantalla completa ───────────────────────────────

test('con la pestaña oculta se pausa el análisis y al volver sigue', function (): void {
    $game = engineTestGame(usage: 'occasional');

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    setTabHidden($page, true);

    expect(waitForEngineStatus($page, 'paused'))->toBe('paused');

    setTabHidden($page, false);

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    $page->assertNoJavaScriptErrors();
});

test('el juego se pone a pantalla completa con el estado de la cámara a la vista', function (): void {
    $game = engineTestGame(usage: 'occasional');

    $page = visit('/play/'.$game->slug);

    useSyntheticCamera($page, 30);
    $page->click('#play-engine-toggle');

    expect(waitForEngineStatus($page, 'running'))->toBe('running');

    $page->click('#play-fullscreen');

    expect(waitForSelector($page, '#play-fullscreen-toolbar'))->toBeTrue()
        ->and($page->script('document.fullscreenElement?.id ?? null'))->toBe('play-stage');

    $page->assertVisible('#play-fullscreen-toolbar #play-camera-status');

    // La barra va al lado del juego, no encima: no tapa sus botones.
    $overlap = $page->script(<<<'JS'
        (() => {
            const game = document.querySelector('#game-frame').getBoundingClientRect();
            const bar = document.querySelector('#play-fullscreen-toolbar').getBoundingClientRect();

            return bar.left < game.right - 1 && bar.right > game.left + 1
                && bar.top < game.bottom - 1 && bar.bottom > game.top + 1;
        })()
    JS);

    expect($overlap)->toBeFalse();

    $page->click('#play-fullscreen-exit');

    expect(waitForSelector($page, '#play-fullscreen-toolbar', present: false))->toBeTrue()
        ->and($page->script('document.fullscreenElement'))->toBeNull();

    $page->assertNoJavaScriptErrors();
});
