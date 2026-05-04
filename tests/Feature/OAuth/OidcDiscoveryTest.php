<?php

/*
 * `/.well-known/openid-configuration` permite a librerías cliente
 * (node-openid-client, authlib, Spring Security…) auto-configurarse
 * conociendo solo la URL del issuer. Estos tests vigilan que los
 * endpoints declarados existan de verdad y que los algoritmos/scopes
 * publicados coincidan con la implementación real.
 */

it('publica el documento de discovery con todos los endpoints obligatorios', function (): void {
    $response = $this->get('/.well-known/openid-configuration');

    $response->assertOk();
    expect($response->headers->get('Cache-Control'))->toContain('public', 'max-age=3600');

    $issuer = rtrim((string) config('app.url'), '/');

    $response->assertExactJson([
        'issuer' => $issuer,
        'authorization_endpoint' => $issuer.'/oauth/authorize',
        'token_endpoint' => $issuer.'/oauth/token',
        'device_authorization_endpoint' => $issuer.'/oauth/device/code',
        'jwks_uri' => $issuer.'/oauth/jwks',
        'userinfo_endpoint' => $issuer.'/api/v1/user/me',
        'scopes_supported' => array_keys((array) config('vout.scopes')),
        'response_types_supported' => ['code'],
        'grant_types_supported' => [
            'authorization_code',
            'refresh_token',
            'client_credentials',
            'urn:ietf:params:oauth:grant-type:device_code',
        ],
        'token_endpoint_auth_methods_supported' => [
            'client_secret_basic',
            'client_secret_post',
            'none',
        ],
        'code_challenge_methods_supported' => ['S256'],
        'subject_types_supported' => ['public'],
        'id_token_signing_alg_values_supported' => ['RS256'],
        'service_documentation' => $issuer.'/developers/docs/integration-guide',
    ]);
});

it('los endpoints declarados en discovery existen de verdad en Vout', function (): void {
    $discovery = $this->get('/.well-known/openid-configuration')->json();

    // jwks_uri responde 200
    $response = $this->get(parse_url($discovery['jwks_uri'], PHP_URL_PATH));
    $response->assertOk();

    // userinfo sin token responde 401/302 (no 404). 404 sería contrato roto.
    $response = $this->get(parse_url($discovery['userinfo_endpoint'], PHP_URL_PATH));
    expect($response->status())->not->toBe(404);

    // token endpoint solo POST → 405 con GET (existe), no 404.
    $response = $this->get(parse_url($discovery['token_endpoint'], PHP_URL_PATH));
    expect($response->status())->toBe(405);
});
