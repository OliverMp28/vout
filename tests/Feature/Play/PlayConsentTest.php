<?php

use App\Models\Game;
use App\Models\OAuthUserGrant;
use App\Models\User;
use App\Notifications\OAuthGrantCreatedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Laravel\Passport\Token;

/*
 * Consentimiento previo a un juego embebido de una app third-party.
 *
 * En el flujo directo el usuario autoriza la app en `/oauth/authorize`.
 * Dentro del portal no hay redirect OAuth: `/play/{game}` muestra la
 * pantalla `play/consent` y `POST /play/{game}/consent` deja el mismo
 * registro en `oauth_user_grants`. Sin ese registro el portal no entrega
 * la identidad del usuario al iFrame.
 */

beforeEach(function (): void {
    $this->withoutVite();
    $this->setUpPassport();
});

// ─── Pantalla de consentimiento ───────────────────────────────────────

it('muestra la pantalla de consentimiento en lugar del juego si la app no está autorizada', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp(['name' => 'Daino']);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('play/consent', false)
            ->where('game.slug', $game->slug)
            ->where('game.name', $game->name)
            ->where('app.name', 'Daino')
            ->where('app.app_url', 'https://embedded.test')
            ->has('scopes', 1)
            ->where('scopes.0.id', 'user:read')
            ->where('scopes.0.description', config('vout.scopes')['user:read'])
            ->missing('session')
        );
});

it('no emite token ni cuenta la partida mientras falta el consentimiento', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();

    $this->actingAs($user)->get(route('play.show', $game))->assertOk();

    expect(Token::query()->count())->toBe(0)
        ->and(DB::table('game_user')->count())->toBe(0);
});

// ─── Registro del consentimiento ──────────────────────────────────────

it('registra el grant con user:read, avisa al usuario y vuelve al juego', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $game = gameWithOAuthApp();

    $this->actingAs($user)
        ->post(route('play.consent.store', $game))
        ->assertRedirect(route('play.show', $game));

    $grant = OAuthUserGrant::query()->sole();

    expect($grant->user_id)->toBe($user->id)
        ->and($grant->client_id)->toBe($game->registeredApp->oauth_client_id)
        ->and($grant->scopes)->toBe(['user:read'])
        ->and($grant->revoked_at)->toBeNull();

    Notification::assertSentTo($user, OAuthGrantCreatedNotification::class);

    $this->actingAs($user)
        ->get(route('play.show', $game))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('play/game', false));
});

it('ignora los scopes que lleguen en la petición: los fija el servidor', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();

    $this->actingAs($user)
        ->post(route('play.consent.store', $game), ['scopes' => ['user:email', 'games:write']])
        ->assertRedirect(route('play.show', $game));

    expect(OAuthUserGrant::query()->sole()->scopes)->toBe(['user:read']);
});

it('reactiva un grant revocado al volver a consentir', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    $grant = authorizeGameApp($user, $game);
    $grant->revoke();

    $this->actingAs($user)
        ->post(route('play.consent.store', $game))
        ->assertRedirect(route('play.show', $game));

    expect(OAuthUserGrant::query()->count())->toBe(1)
        ->and($grant->fresh()->revoked_at)->toBeNull();

    Notification::assertSentTo($user, OAuthGrantCreatedNotification::class);
});

it('amplía con user:read un grant activo que no lo incluía, sin perder scopes', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    $grant = authorizeGameApp($user, $game, ['user:email']);

    $this->actingAs($user)->post(route('play.consent.store', $game));

    expect($grant->fresh()->scopes)->toEqualCanonicalizing(['user:email', 'user:read']);
});

it('no crea grant cuando el juego no lo necesita', function (Game $game): void {
    $this->actingAs(User::factory()->create())
        ->post(route('play.consent.store', $game))
        ->assertRedirect(route('play.show', $game));

    expect(OAuthUserGrant::query()->count())->toBe(0);
})->with([
    'app first-party' => fn (): Game => gameWithOAuthApp(['is_first_party' => true]),
    'juego sin app' => fn (): Game => Game::factory()->create(['is_active' => true]),
]);

// ─── Acceso ───────────────────────────────────────────────────────────

it('exige sesión para consentir', function (): void {
    $game = gameWithOAuthApp();

    $this->post(route('play.consent.store', $game))->assertRedirect(route('login'));

    expect(OAuthUserGrant::query()->count())->toBe(0);
});

it('devuelve 404 al consentir sobre un juego inactivo', function (): void {
    $game = gameWithOAuthApp();
    $game->update(['is_active' => false]);

    $this->actingAs(User::factory()->create())
        ->post(route('play.consent.store', $game))
        ->assertNotFound();

    expect(OAuthUserGrant::query()->count())->toBe(0);
});
