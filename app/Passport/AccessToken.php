<?php

namespace App\Passport;

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
     * añadiendo `kid` (header) e `iss` (claim). El resto de claims se
     * replica del trait original — si Passport los modifica en una
     * actualización, hay que sincronizar aquí.
     */
    public function toString(): string
    {
        $this->initJwtConfiguration();

        $token = $this->jwtConfiguration->builder()
            ->withHeader('kid', Jwks::keyId())
            ->issuedBy(rtrim((string) config('app.url'), '/'))
            ->permittedFor($this->getClient()->getIdentifier())
            ->identifiedBy($this->getIdentifier())
            ->issuedAt(new DateTimeImmutable)
            ->canOnlyBeUsedAfter(new DateTimeImmutable)
            ->expiresAt($this->getExpiryDateTime())
            ->relatedTo($this->getSubjectIdentifier())
            ->withClaim('scopes', $this->getScopes())
            ->getToken($this->jwtConfiguration->signer(), $this->jwtConfiguration->signingKey());

        return $token->toString();
    }
}
