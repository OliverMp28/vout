<?php

use App\Support\Jwks;

/*
 * `/oauth/jwks` es la pieza que permite a Resource Servers del ecosistema
 * verificar la firma de los Access Tokens emitidos por Vout sin acoplarse
 * a su BD. Si rompemos el contrato, todos los integradores stateless dejan
 * de validar tokens. Estos tests blindan:
 *
 *   - estructura RFC 7517 (kty, use, alg, kid, n, e),
 *   - thumbprint RFC 7638 reproducible (kid = SHA-256 canónico),
 *   - cacheo HTTP + content-type correcto,
 *   - acceso público (sin auth ni CSRF).
 */

it('expone /oauth/jwks como JSON con un único JWK RSA', function (): void {
    $response = $this->get('/oauth/jwks');

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/jwk-set+json');
    expect($response->headers->get('Cache-Control'))->toContain('public', 'max-age=3600');

    $body = $response->json();
    expect($body)->toHaveKey('keys');
    expect($body['keys'])->toBeArray()->toHaveCount(1);

    $jwk = $body['keys'][0];
    expect($jwk)->toMatchArray([
        'kty' => 'RSA',
        'use' => 'sig',
        'alg' => 'RS256',
    ]);
    expect($jwk)->toHaveKeys(['kid', 'n', 'e']);
    expect($jwk['n'])->toBeString()->not->toBeEmpty();
    expect($jwk['e'])->toBeString()->not->toBeEmpty();
});

it('el kid del JWK coincide con el thumbprint RFC 7638 derivado de n,e', function (): void {
    $jwk = $this->get('/oauth/jwks')->json('keys.0');

    $canonical = sprintf('{"e":"%s","kty":"RSA","n":"%s"}', $jwk['e'], $jwk['n']);
    $expected = rtrim(strtr(base64_encode(hash('sha256', $canonical, true)), '+/', '-_'), '=');

    expect($jwk['kid'])->toBe($expected);
    expect($jwk['kid'])->toBe(Jwks::keyId());
});

it('reconstruir la PEM desde n,e produce la misma clave que storage/oauth-public.key', function (): void {
    $jwk = $this->get('/oauth/jwks')->json('keys.0');

    // Tomamos los detalles RSA del JWK y los comparamos con el storage real
    $n = base64_decode(strtr($jwk['n'], '-_', '+/'));
    $e = base64_decode(strtr($jwk['e'], '-_', '+/'));

    $pemFromStorage = file_get_contents(storage_path('oauth-public.key'));
    $details = openssl_pkey_get_details(openssl_pkey_get_public($pemFromStorage));

    expect($details['rsa']['n'])->toBe($n);
    expect($details['rsa']['e'])->toBe($e);
});

it('es público (sin auth) y no requiere CSRF', function (): void {
    $response = $this->get('/oauth/jwks');
    $response->assertOk();

    // Nada de redirección a login, nada de 419.
    $response->assertStatus(200);
});

it('no envía cookies de sesión (regresión: evita session fixation por CDN cache)', function (): void {
    // El endpoint declara `Cache-Control: public, max-age=3600` para que
    // CDNs y proxies puedan cachear. Si la respuesta llevara
    // `Set-Cookie: vout-session=...`, un CDN podría almacenar la cookie
    // de un usuario y servirla a todos los siguientes (session fixation
    // clásico). La pila de sesión/cookies está retirada en routes/web.php
    // — este test garantiza que sigue retirada.
    $response = $this->get('/oauth/jwks');

    expect($response->headers->getCookies())->toBeEmpty();
    expect($response->headers->all('Set-Cookie'))->toBeEmpty();
});

it('discovery endpoint tampoco envía cookies de sesión', function (): void {
    $response = $this->get('/.well-known/openid-configuration');

    expect($response->headers->getCookies())->toBeEmpty();
    expect($response->headers->all('Set-Cookie'))->toBeEmpty();
});
