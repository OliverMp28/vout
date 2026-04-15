<?php

use App\Enums\GameStatus;
use App\Models\Game;
use App\Models\User;

it('castea el estado a la enum al leer del modelo', function (): void {
    $game = Game::factory()->pendingReview()->create();

    expect($game->fresh()->status)->toBe(GameStatus::PendingReview);
});

it('default del modelo coincide con la migración (Published)', function (): void {
    $game = new Game;

    expect($game->status)->toBe(GameStatus::Published);
});

it('scopePublished filtra solo juegos en estado Published', function (): void {
    $dev = User::factory()->create();
    Game::factory()->submittedBy($dev)->draft()->create();
    Game::factory()->submittedBy($dev)->pendingReview()->create();
    Game::factory()->count(2)->create(); // default Published

    expect(Game::query()->published()->count())->toBe(2);
});

it('scopeSubmittedBy aísla los juegos del desarrollador autor', function (): void {
    $alice = User::factory()->create();
    $bob = User::factory()->create();
    Game::factory()->submittedBy($alice)->count(3)->create();
    Game::factory()->submittedBy($bob)->count(2)->create();

    expect(Game::query()->submittedBy($alice)->count())->toBe(3)
        ->and(Game::query()->submittedBy($bob)->count())->toBe(2);
});

it('isEditable es verdadero solo para draft, pending_review y rejected', function (): void {
    expect(GameStatus::Draft->isEditable())->toBeTrue()
        ->and(GameStatus::PendingReview->isEditable())->toBeTrue()
        ->and(GameStatus::Rejected->isEditable())->toBeTrue()
        ->and(GameStatus::Published->isEditable())->toBeFalse();
});

it('isPublic solo es verdadero para Published', function (): void {
    expect(GameStatus::Published->isPublic())->toBeTrue()
        ->and(GameStatus::Draft->isPublic())->toBeFalse()
        ->and(GameStatus::PendingReview->isPublic())->toBeFalse()
        ->and(GameStatus::Rejected->isPublic())->toBeFalse();
});
