<?php

use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Str;
use Laravel\Passport\Token;

/*
 * Renovación del token de una sesión de juego embebido
 * (`POST /play/{game}/token`).
 *
 * El juego dentro del iFrame no puede refrescar su token, así que el
 * portal pide uno nuevo antes de que caduque el anterior y lo reenvía
 * con otro `VOUT_AUTH`. La autoridad es la sesión web del usuario.
 */

beforeEach(function (): void {
    $this->setUpPassport();
});

it('devuelve un token nuevo para el client de la app, sin permitir cacheo', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    authorizeGameApp($user, $game);

    $response = $this->actingAs($user)
        ->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])
        ->assertOk()
        ->assertJsonStructure(['token', 'expires_at'])
        ->assertHeader('Pragma', 'no-cache');

    expect($response->headers->get('Cache-Control'))->toContain('no-store');

    $payload = decodeJwtSection($response->json('token'), 1);

    expect($payload['aud'])->toBe($game->registeredApp->oauth_client_id)
        ->and($payload['scopes'])->toBe(['user:read'])
        ->and($payload['vout_id'])->toBe($user->vout_id)
        ->and($response->json('expires_at'))->toBe((int) floor($payload['exp']));
});

it('cada renovación emite un token distinto', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $first = $this->actingAs($user)->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])->json('token');
    $second = $this->actingAs($user)->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])->json('token');

    expect($first)->not->toBe($second)
        ->and(Token::query()->count())->toBe(2);
});

it('responde 401 si la sesión web caducó', function (): void {
    $game = Game::factory()->create(['is_active' => true]);

    $this->postJson(route('play.token.store', $game), ['vout_id' => (string) Str::uuid()])->assertUnauthorized();

    expect(Token::query()->count())->toBe(0);
});

it('responde 403 si la app third-party no está autorizada', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();

    $this->actingAs($user)
        ->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])
        ->assertForbidden();

    expect(Token::query()->count())->toBe(0);
});

it('deja de renovar en cuanto el usuario revoca la app', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    $grant = authorizeGameApp($user, $game);

    $this->actingAs($user)->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])->assertOk();

    $grant->revoke();

    $this->actingAs($user)->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])->assertForbidden();

    expect(Token::query()->where('revoked', false)->count())->toBe(0);
});

it('responde 404 para juegos inactivos', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->inactive()->create();

    $this->actingAs($user)
        ->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])
        ->assertNotFound();
});

it('responde 409 y no emite nada si la sesión web es ahora de otra cuenta', function (): void {
    $pageOwner = User::factory()->create();
    $currentUser = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs($currentUser)
        ->postJson(route('play.token.store', $game), ['vout_id' => $pageOwner->vout_id])
        ->assertConflict();

    expect(Token::query()->count())->toBe(0);
});

it('exige el vout_id de la página para renovar', function (array $payload): void {
    $game = Game::factory()->create(['is_active' => true]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('play.token.store', $game), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('vout_id');

    expect(Token::query()->count())->toBe(0);
})->with([
    'sin vout_id' => [[]],
    'vout_id que no es un UUID' => [['vout_id' => 'no-es-un-uuid']],
]);

it('limita el ritmo de renovaciones por usuario', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);

    foreach (range(1, 12) as $attempt) {
        $this->actingAs($user)->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])->assertOk();
    }

    $this->actingAs($user)->postJson(route('play.token.store', $game), ['vout_id' => $user->vout_id])->assertTooManyRequests();
});
