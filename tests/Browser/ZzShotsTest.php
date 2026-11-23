<?php
beforeEach(function (): void { $this->setUpPassport(); registerEngineGameRoutes(); });
test('shots', function (): void {
    $game = engineTestGame(usage: 'occasional', announcesReady: true);
    $page = visit('/play/'.$game->slug);
    useSyntheticCamera($page, 30);
    $page->click('#play-engine-toggle');
    waitForEngineStatus($page, 'running');
    $page->click('#play-preview-toggle');
    $page->click('#play-fullscreen');
    waitForSelector($page, '#play-fullscreen-toolbar');
    usleep(800000);
    $page->screenshot(fullPage: false, filename: 'e-fullscreen');
});
