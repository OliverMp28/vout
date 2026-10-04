<?php

namespace App\Services;

use App\Models\Game;
use App\Models\OAuthUserGrant;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Support\GameSessionToken;
use Illuminate\Auth\Access\AuthorizationException;
use Laravel\Passport\Bridge\AccessTokenRepository;
use Laravel\Passport\Bridge\ClientRepository;
use Laravel\Passport\Bridge\Scope;
use Laravel\Passport\Bridge\ScopeRepository;
use Laravel\Passport\Passport;
use League\OAuth2\Server\CryptKey;
use League\OAuth2\Server\Entities\ClientEntityInterface;

/**
 * Emite el token de identidad que el portal entrega a un juego embebido
 * durante el handshake `READY → VOUT_AUTH`.
 *
 * El token es un Access Token normal de Vout (JWT RS256 con `kid`, `iss`
 * y `vout_id`, ver `App\Passport\AccessToken`) con la misma vida que los
 * de `/oauth/token` (`vout.passport.access_token_ttl_minutes`). Lo que
 * cambia según el juego es para quién se emite:
 *
 *   1. Juego de una app con client OAuth activo → `aud` = ese client y
 *      scope `user:read`. El juego lo valida igual que los tokens que
 *      obtiene por Authorization Code. Si la app es third-party, solo se
 *      emite cuando el usuario ya la autorizó (`oauth_user_grants`).
 *   2. Juego sin client OAuth (catálogo curado, apps cliente-puro) →
 *      token de portal: `aud` = Personal Access Client y scope
 *      `game:play`.
 *
 * No pasa por `/oauth/token` ni registra ningún grant nuevo en el
 * AuthorizationServer: reutiliza los repositorios de Passport igual que
 * `League\OAuth2\Server\Grant\AbstractGrant::issueAccessToken()`, de modo
 * que la emisión solo es alcanzable desde código del portal con una
 * sesión web autenticada.
 */
class GameSessionTokenIssuer
{
    /**
     * Scopes del token cuando el juego pertenece a una app con client OAuth.
     *
     * @var list<string>
     */
    public const array APP_SCOPES = ['user:read'];

    /**
     * Scopes del token de portal para juegos sin client OAuth.
     *
     * @var list<string>
     */
    public const array PORTAL_SCOPES = ['game:play'];

    /**
     * Prefijo del `name` en `oauth_access_tokens`: distingue las sesiones
     * embebidas de los tokens obtenidos por Authorization Code.
     */
    public const string TOKEN_NAME_PREFIX = 'game-session:';

    private const string GRANT_IDENTIFIER = 'vout_game_session';

    /**
     * @var array<string, ClientEntityInterface|null>
     */
    private array $resolvedClients = [];

    public function __construct(
        private readonly AccessTokenRepository $accessTokens,
        private readonly ClientRepository $clients,
        private readonly ScopeRepository $scopes,
    ) {}

    /**
     * Indica si el usuario debe autorizar la app del juego antes de que
     * el portal pueda entregarle su identidad.
     *
     * Solo aplica a apps third-party con client OAuth activo: las
     * first-party y los juegos sin client nunca piden consentimiento.
     */
    public function requiresConsent(User $user, Game $game): bool
    {
        return $this->appClient($game) !== null
            && $this->lacksConsent($user, $game->registeredApp);
    }

    /**
     * Emite el token de sesión para el par (usuario, juego).
     *
     * @throws AuthorizationException si la app es third-party y el usuario no la ha autorizado.
     */
    public function issue(User $user, Game $game): GameSessionToken
    {
        $appClient = $this->appClient($game);

        if ($appClient === null) {
            return $this->mint(
                $user,
                $game,
                $this->clients->getPersonalAccessClientEntity($user->getProviderName()),
                self::PORTAL_SCOPES,
            );
        }

        if ($this->lacksConsent($user, $game->registeredApp)) {
            throw new AuthorizationException(__('play.consent.required'));
        }

        return $this->mint($user, $game, $appClient, self::APP_SCOPES);
    }

    /**
     * Client OAuth activo de la app del juego, o null si el juego no
     * pertenece a ninguna app, la app no usa OAuth o su client fue revocado.
     */
    private function appClient(Game $game): ?ClientEntityInterface
    {
        $clientId = $game->registeredApp?->oauth_client_id;

        if ($clientId === null) {
            return null;
        }

        return $this->resolvedClients[$clientId] ??= $this->clients->getClientEntity($clientId);
    }

    private function lacksConsent(User $user, RegisteredApp $app): bool
    {
        if ($app->is_first_party) {
            return false;
        }

        $grant = OAuthUserGrant::query()
            ->active()
            ->where('user_id', $user->getKey())
            ->where('client_id', $app->oauth_client_id)
            ->first();

        return $grant === null || ! $grant->coversScopes(self::APP_SCOPES);
    }

    /**
     * @param  list<string>  $scopeIds
     */
    private function mint(User $user, Game $game, ClientEntityInterface $client, array $scopeIds): GameSessionToken
    {
        $userIdentifier = (string) $user->getAuthIdentifier();

        $scopes = $this->scopes->finalizeScopes(
            array_map(static fn (string $id): Scope => new Scope($id), $scopeIds),
            self::GRANT_IDENTIFIER,
            $client,
            $userIdentifier,
        );

        $expiresAt = now()->add(Passport::tokensExpireIn());

        $accessToken = $this->accessTokens->getNewToken($client, $scopes, $userIdentifier);
        $accessToken->setExpiryDateTime($expiresAt);
        $accessToken->setPrivateKey($this->signingKey());
        $accessToken->setIdentifier(bin2hex(random_bytes(40)));

        $this->accessTokens->persistNewAccessToken($accessToken);

        Passport::token()->newQuery()
            ->whereKey($accessToken->getIdentifier())
            ->update(['name' => self::TOKEN_NAME_PREFIX.$game->slug]);

        return new GameSessionToken($accessToken->toString(), $expiresAt);
    }

    /**
     * Clave privada de firma, resuelta igual que
     * `Laravel\Passport\PassportServiceProvider::makeCryptKey()`.
     */
    private function signingKey(): CryptKey
    {
        $key = str_replace('\\n', "\n", (string) config('passport.private_key'));

        if ($key === '') {
            $key = 'file://'.Passport::keyPath('oauth-private.key');
        }

        return new CryptKey($key, null, Passport::$validateKeyPermissions);
    }
}
