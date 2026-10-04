<?php

use App\Models\Game;
use App\Models\OAuthUserGrant;
use App\Models\User;
use App\Services\GameSessionTokenIssuer;
use App\Support\Jwks;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Passport\ClientRepository;
use Laravel\Passport\Token;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\Validation\Constraint\SignedWith;
use Lcobucci\JWT\Validation\Validator;

/*
 * Contrato del token que el portal entrega a un juego embebido
 * (`GameSessionTokenIssuer`). Un Resource Server como Daino lo valida
 * exactamente igual que los de `/oauth/token`, así que aquí se fija lo
 * que ese validador exige: `aud` = su client_id, `kid`, `iss`, `vout_id`,
 * `iat`/`nbf`/`exp` y la TTL de los access tokens (no la de los PAT).
 */

beforeEach(function (): void {
    $this->setUpPassport();
});

// ─── Juego de una app con client OAuth ────────────────────────────────

it('emite el token para el client de la app embebida, con scope user:read', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    authorizeGameApp($user, $game);

    $session = app(GameSessionTokenIssuer::class)->issue($user, $game);
    $payload = decodeJwtSection($session->token, 1);

    expect($payload['aud'])->toBe($game->registeredApp->oauth_client_id)
        ->and($payload['scopes'])->toBe(['user:read'])
        ->and($payload['vout_id'])->toBe($user->vout_id)
        ->and($payload['sub'])->toBe((string) $user->id)
        ->and($payload['iss'])->toBe(rtrim((string) config('app.url'), '/'))
        ->and($payload)->toHaveKeys(['jti', 'iat', 'nbf', 'exp']);
});

it('lleva kid en el header y una firma verificable con la clave pública', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp(['is_first_party' => true]);

    $session = app(GameSessionTokenIssuer::class)->issue($user, $game);

    expect(decodeJwtSection($session->token, 0))->toMatchArray([
        'typ' => 'JWT',
        'alg' => 'RS256',
        'kid' => Jwks::keyId(),
    ]);

    $signedWith = new SignedWith(
        new Sha256,
        InMemory::plainText(file_get_contents(storage_path('oauth-public.key'))),
    );

    expect((new Validator)->validate((new Parser(new JoseEncoder))->parse($session->token), $signedWith))
        ->toBeTrue();
});

it('caduca con la TTL de los access tokens, no con la de los PAT', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp(['is_first_party' => true]);
    $ttlSeconds = config('vout.passport.access_token_ttl_minutes') * 60;

    $session = app(GameSessionTokenIssuer::class)->issue($user, $game);
    $payload = decodeJwtSection($session->token, 1);

    expect($payload['exp'] - $payload['iat'])
        ->toBeGreaterThan($ttlSeconds - 5)
        ->toBeLessThanOrEqual($ttlSeconds)
        ->and($session->expiresAt->getTimestamp())->toBe((int) floor($payload['exp']))
        ->and($session->toArray())->toBe([
            'token' => $session->token,
            'expires_at' => $session->expiresAt->getTimestamp(),
        ]);
});

it('persiste el token identificado como sesión de juego del client de la app', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp(['is_first_party' => true]);

    $session = app(GameSessionTokenIssuer::class)->issue($user, $game);
    $token = Token::query()->findOrFail(decodeJwtSection($session->token, 1)['jti']);

    expect($token->client_id)->toBe($game->registeredApp->oauth_client_id)
        ->and((int) $token->user_id)->toBe($user->id)
        ->and($token->name)->toBe('game-session:'.$game->slug)
        ->and($token->scopes)->toBe(['user:read'])
        ->and($token->revoked)->toBeFalse();
});

it('sirve como Bearer contra la API de Vout, igual que un token de /oauth/token', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    authorizeGameApp($user, $game);

    $session = app(GameSessionTokenIssuer::class)->issue($user, $game);

    $this->withToken($session->token)
        ->getJson(route('api.v1.user.me'))
        ->assertOk()
        ->assertJsonPath('data.vout_id', $user->vout_id)
        ->assertJsonMissingPath('data.email');
});

// ─── Consentimiento (apps third-party) ────────────────────────────────

it('se niega a emitir si el usuario no ha autorizado la app third-party', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    $issuer = app(GameSessionTokenIssuer::class);

    expect($issuer->requiresConsent($user, $game))->toBeTrue()
        ->and(fn () => $issuer->issue($user, $game))->toThrow(AuthorizationException::class)
        ->and(Token::query()->count())->toBe(0);
});

it('exige consentimiento de nuevo si el grant fue revocado o no cubre user:read', function (array $grantState): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    authorizeGameApp($user, $game)->forceFill($grantState)->save();

    expect(app(GameSessionTokenIssuer::class)->requiresConsent($user, $game))->toBeTrue();
})->with([
    'grant revocado' => fn (): array => ['revoked_at' => now()],
    'grant sin user:read' => fn (): array => ['scopes' => ['user:email']],
]);

it('el consentimiento de otro usuario no sirve', function (): void {
    $game = gameWithOAuthApp();
    authorizeGameApp(User::factory()->create(), $game);

    expect(app(GameSessionTokenIssuer::class)->requiresConsent(User::factory()->create(), $game))->toBeTrue();
});

it('emite sin notificar ni duplicar el grant cuando la app ya está autorizada', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    authorizeGameApp($user, $game);
    $issuer = app(GameSessionTokenIssuer::class);

    expect($issuer->requiresConsent($user, $game))->toBeFalse();

    $issuer->issue($user, $game);
    $issuer->issue($user, $game);

    expect(OAuthUserGrant::query()->count())->toBe(1);
    Notification::assertNothingSent();
});

it('no pide consentimiento ni registra grant para apps first-party', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp(['is_first_party' => true]);
    $issuer = app(GameSessionTokenIssuer::class);

    expect($issuer->requiresConsent($user, $game))->toBeFalse();

    $payload = decodeJwtSection($issuer->issue($user, $game)->token, 1);

    expect($payload['aud'])->toBe($game->registeredApp->oauth_client_id)
        ->and(OAuthUserGrant::query()->count())->toBe(0);
});

// ─── Juegos sin client OAuth (token de portal) ────────────────────────

it('emite un token de portal con scope game:play para juegos sin app', function (): void {
    $user = User::factory()->create();
    $game = Game::factory()->create(['is_active' => true]);
    $issuer = app(GameSessionTokenIssuer::class);
    $ttlSeconds = config('vout.passport.access_token_ttl_minutes') * 60;

    expect($issuer->requiresConsent($user, $game))->toBeFalse();

    $payload = decodeJwtSection($issuer->issue($user, $game)->token, 1);

    expect($payload['aud'])->toBe(app(ClientRepository::class)->personalAccessClient('users')->id)
        ->and($payload['scopes'])->toBe(['game:play'])
        ->and($payload['vout_id'])->toBe($user->vout_id)
        ->and($payload['exp'] - $payload['iat'])->toBeLessThanOrEqual($ttlSeconds);
});

it('cae al token de portal si el client de la app está revocado', function (): void {
    $user = User::factory()->create();
    $game = gameWithOAuthApp();
    DB::table('oauth_clients')
        ->where('id', $game->registeredApp->oauth_client_id)
        ->update(['revoked' => true]);
    $issuer = app(GameSessionTokenIssuer::class);

    expect($issuer->requiresConsent($user, $game))->toBeFalse();

    $payload = decodeJwtSection($issuer->issue($user, $game)->token, 1);

    expect($payload['aud'])->not->toBe($game->registeredApp->oauth_client_id)
        ->and($payload['scopes'])->toBe(['game:play']);
});

// ─── Migración: revocación de los tokens de sesión heredados ──────────

it('la migración revoca solo los game-session de larga duración', function (): void {
    $user = User::factory()->create();
    $clientId = app(ClientRepository::class)->personalAccessClient('users')->id;

    $makeToken = fn (string $name, DateTimeInterface $expiresAt): Token => Token::create([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $clientId,
        'name' => $name,
        'scopes' => ['game:play'],
        'revoked' => false,
        'expires_at' => $expiresAt,
    ]);

    $legacy = $makeToken('game-session:dino', now()->addMonths(5));
    $current = $makeToken('game-session:dino', now()->addMinutes(30));
    $developerPat = $makeToken('e2e', now()->addMonths(5));

    (require database_path('migrations/2026_10_03_224153_revoke_legacy_game_session_tokens.php'))->up();

    expect($legacy->fresh()->revoked)->toBeTrue()
        ->and($current->fresh()->revoked)->toBeFalse()
        ->and($developerPat->fresh()->revoked)->toBeFalse();
});
