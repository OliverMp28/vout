<?php

namespace App\Passport;

use App\Models\User;
use App\Support\Jwks;
use DateTimeImmutable;
use League\OAuth2\Server\Entities\AccessTokenEntityInterface;
use League\OAuth2\Server\Entities\ClientEntityInterface;
use League\OAuth2\Server\Entities\ScopeEntityInterface;
use League\OAuth2\Server\Entities\Traits\AccessTokenTrait;
use League\OAuth2\Server\Entities\Traits\EntityTrait;
use League\OAuth2\Server\Entities\Traits\TokenEntityTrait;

/**
 * AccessToken personalizado de Vout.
 *
 * Sustituye al `Laravel\Passport\Bridge\AccessToken` por defecto vía
 * `Passport::useAccessTokenEntity()` para que cada JWT emitido lleve:
 *
 *   - `kid` en el header — apunta al JWK público (`/oauth/jwks`) para
 *     que un Resource Server pueda elegir la clave correcta sin
 *     adivinar. Lo más importante de esta clase.
 *   - `iss` en el payload — URL del IdP. Permite validar emisor con
 *     `lcobucci/jwt` y similares (`assert($jwt->claims()->get('iss') === ...)`).
 *   - `vout_id` en el payload — UUID canónico del usuario en Vout. Es el
 *     mismo valor que devuelve `/api/v1/user/me`. Permite a los Resource
 *     Servers mapear el JWT a su `users.vout_id` local sin un round-trip
 *     a `/me`. `sub` sigue siendo el id interno (entero) por compatibilidad
 *     RFC 7519. En tokens client_credentials (sin user) este claim no se
 *     emite.
 *
 * El resto del JWT (aud, sub, scopes, exp, iat, nbf, jti) sigue
 * comportándose como en upstream.
 */
class AccessToken implements AccessTokenEntityInterface
{
    use AccessTokenTrait;
    use EntityTrait;
    use TokenEntityTrait;

    /**
     * Firma idéntica a `Laravel\Passport\Bridge\AccessToken::__construct()`.
     *
     * @param  non-empty-string|null  $userIdentifier
     * @param  ScopeEntityInterface[]  $scopes
     */
    public function __construct(?string $userIdentifier, array $scopes, ClientEntityInterface $client)
    {
        if ($userIdentifier !== null) {
            $this->setUserIdentifier($userIdentifier);
        }

        foreach ($scopes as $scope) {
            $this->addScope($scope);
        }

        $this->setClient($client);
    }

    /**
     * Override de `AccessTokenTrait::toString()` que reconstruye el JWT
     * añadiendo `kid` (header), `iss` y `vout_id` (claims). El resto de
     * claims se replica del trait original — si Passport los modifica en
     * una actualización, hay que sincronizar aquí.
     */
    public function toString(): string
    {
        $this->initJwtConfiguration();

        $builder = $this->jwtConfiguration->builder()
            ->withHeader('kid', Jwks::keyId())
            ->issuedBy(rtrim((string) config('app.url'), '/'))
            ->permittedFor($this->getClient()->getIdentifier())
            ->identifiedBy($this->getIdentifier())
            ->issuedAt(new DateTimeImmutable)
            ->canOnlyBeUsedAfter(new DateTimeImmutable)
            ->expiresAt($this->getExpiryDateTime())
            ->relatedTo($this->getSubjectIdentifier())
            ->withClaim('scopes', $this->getScopes());

        $voutId = $this->resolveVoutId();
        if ($voutId !== null) {
            $builder = $builder->withClaim('vout_id', $voutId);
        }

        $token = $builder->getToken($this->jwtConfiguration->signer(), $this->jwtConfiguration->signingKey());

        return $token->toString();
    }

    /**
     * Devuelve el `vout_id` (UUID) del usuario asociado al token, o
     * null si el token no tiene user (client_credentials) o si por
     * cualquier razón el user no existe (defensa, no debería ocurrir).
     *
     * Solo se ejecuta una vez por emisión de token (en `/oauth/token`),
     * no en cada request — el coste de la query es despreciable.
     */
    private function resolveVoutId(): ?string
    {
        $userId = $this->getUserIdentifier();

        if ($userId === null) {
            return null;
        }

        $voutId = User::query()
            ->whereKey($userId)
            ->value('vout_id');

        return $voutId !== null ? (string) $voutId : null;
    }
}
