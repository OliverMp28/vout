<?php

use App\Enums\AccountRequirement;
use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\Token;

/*
 * Jugar sin cuenta (`games.account_requirement`).
 *
 * `/play/{game}` está abierto a invitados: quién puede jugar y si el juego
 * recibe la identidad lo decide el modo de cada juego. Sin identidad no se
 * emite token (`session` null) y el portal saluda al juego con VOUT_GUEST.
 */

beforeEach(function (): void {
    $this->withoutVite();
    $this->setUpPassport();
});

// ─── Invitados ────────────────────────────────────────────────────────

it('un invitado juega sin token a un juego que no usa la cuenta o la deja opcional', function (string $factoryState, ?string $notice): void {
    $game = Game::factory()->{$factoryState}()->create(['is_active' => true]);

    $this->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('play/game', false)
            ->where('game.account_requirement', $game->account_requirement->value)
            ->where('session', null)
            ->where('activeGestureConfig', null)
            ->where('presetChoice', null)
            ->where('guestNotice', $notice)
        );

    expect(Token::query()->count())->toBe(0)
        ->and(DB::table('game_user')->count())->toBe(0);
})->with([
    'sin cuenta' => ['withoutAccount', null],
    'cuenta opcional' => ['accountOptional', 'guest'],
]);

it('manda a entrar a un invitado en un juego de cuenta obligatoria y vuelve al juego tras el login', function (): void {
    $game = Game::factory()->create(['is_active' => true]);

    $this->get(route('play.show', $game))
        ->assertRedirect(route('login'));

    expect(session('url.intended'))->toBe(route('play.show', $game));
});

it('"Entrar" desde el juego guarda el juego como destino tras el login', function (): void {
    $game = Game::factory()->accountOptional()->create(['is_active' => true]);

    $this->get(route('play.sign-in', $game))
        ->assertRedirect(route('login'));

    expect(session('url.intended'))->toBe(route('play.show', $game));
});

it('"Entrar" con la sesión ya iniciada vuelve directo al juego', function (): void {
    $game = Game::factory()->accountOptional()->create(['is_active' => true]);

    $this->actingAs(User::factory()->create())
        ->get(route('play.sign-in', $game))
        ->assertRedirect(route('play.show', $game));
});

it('"Entrar" no revela juegos inactivos', function (): void {
    $game = Game::factory()->accountOptional()->inactive()->create();

    $this->get(route('play.sign-in', $game))->assertNotFound();
});

it('un invitado no ve un juego inactivo aunque admita invitados', function (): void {
    $game = Game::factory()->withoutAccount()->inactive()->create();

    $this->get(route('play.show', $game))->assertNotFound();
});

it('un invitado no puede pedir token ni guardar controles', function (): void {
    $game = Game::factory()->accountOptional()->create(['is_active' => true]);

    $this->postJson(route('play.token.store', $game), ['vout_id' => 'x'])->assertUnauthorized();
    $this->putJson(route('play.preset.update', $game), ['choice' => 'own'])->assertUnauthorized();
});

// ─── Con cuenta ───────────────────────────────────────────────────────

it('una cuenta confirmada recibe su identidad en un juego de cuenta opcional', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->accountOptional()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('session.token')
            ->where('guestNotice', null)
        );
});

it('un juego que no usa la cuenta nunca recibe la identidad, pero la partida cuenta', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->withoutAccount()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('session', null)
            ->where('guestNotice', null)
        );

    expect(Token::query()->count())->toBe(0)
        ->and(DB::table('game_user')->where('user_id', $user->id)->value('play_count'))->toBe(1);
});

it('no renueva el token de un juego que no usa la cuenta', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->withoutAccount()->create(['is_active' => true]);

    $this->actingAs($user)
        ->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])
        ->assertForbidden();

    expect(Token::query()->count())->toBe(0);
});

it('una cuenta sin el correo confirmado juega sin identidad donde se admiten invitados', function (): void {
    $user = User::factory()->unverified()->create();
    $game = Game::factory()->accountOptional()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('session', null)
            ->where('guestNotice', 'unverified')
        );

    expect(Token::query()->count())->toBe(0);
});

it('una cuenta sin el correo confirmado tiene que confirmarlo para un juego de cuenta obligatoria', function (): void {
    $user = User::factory()->unverified()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertRedirect(route('verification.notice'));
});

// ─── Apps de terceros ─────────────────────────────────────────────────

it('una app de terceros sin cuenta no pide consentimiento ni recibe la identidad', function (): void {
    $game = gameWithOAuthApp();
    $game->update(['account_requirement' => AccountRequirement::None]);

    $this->actingAs(User::factory()->create())
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('play/game', false)
            ->where('session', null)
        );
});

it('el consentimiento ofrece jugar sin compartir la cuenta solo si el juego lo admite', function (AccountRequirement $requirement, bool $canPlayAsGuest): void {
    $game = gameWithOAuthApp();
    $game->update(['account_requirement' => $requirement]);

    $this->actingAs(User::factory()->create())
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('play/consent', false)
            ->where('canPlayAsGuest', $canPlayAsGuest)
        );
})->with([
    'cuenta opcional' => [AccountRequirement::Optional, true],
    'cuenta obligatoria' => [AccountRequirement::Required, false],
]);

it('quien elige no compartir su cuenta juega sin identidad y sin autorizar la app', function (): void {
    $game = gameWithOAuthApp();
    $game->update(['account_requirement' => AccountRequirement::Optional]);

    $this->actingAs(User::factory()->create())
        ->get(route('play.show', [$game, 'guest' => 1]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('play/game', false)
            ->where('session', null)
            ->where('guestNotice', 'declined')
        );

    expect(Token::query()->count())->toBe(0)
        ->and(DB::table('oauth_user_grants')->count())->toBe(0);
});

it('jugar sin compartir la cuenta no vale en un juego de cuenta obligatoria', function (): void {
    $game = gameWithOAuthApp();

    $this->actingAs(User::factory()->create())
        ->get(route('play.show', [$game, 'guest' => 1]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('play/consent', false));
});

// ─── Ficha del juego ──────────────────────────────────────────────────

it('la ficha del juego dice si hace falta cuenta', function (string $factoryState, string $expected): void {
    $game = Game::factory()->{$factoryState}()->create(['is_active' => true]);

    $this->get(route('catalog.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('game.data.account_requirement', $expected));
})->with([
    'sin cuenta' => ['withoutAccount', 'none'],
    'cuenta opcional' => ['accountOptional', 'optional'],
]);
