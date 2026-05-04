<?php

namespace App\Http\Controllers\OAuth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * `GET /.well-known/openid-configuration` — Discovery metadata.
 *
 * Permite a librerías cliente OAuth2/OIDC (node-openid-client, authlib,
 * Spring Security, jose-jwt, etc.) auto-configurarse con una sola URL:
 * apuntan al issuer y de ahí descubren los endpoints (`authorization`,
 * `token`, `jwks_uri`, `userinfo`).
 *
 * Aviso honesto: Vout es un servidor **OAuth 2.0 con Access Tokens
 * firmados (RS256)**, no un IdP OIDC completo. No emite ID Tokens ni
 * implementa la mecánica de `nonce` de OIDC. Exponemos esta URL porque:
 *
 *   - Es la convención de descubrimiento más extendida y muchas libs la
 *     buscan automáticamente, incluso para flows OAuth2 puros.
 *   - El subset publicado (jwks_uri + userinfo + endpoints OAuth) es
 *     consistente y útil para Resource Servers que solo validan firma.
 *
 * Para integradores OAuth2 estrictos también respondemos en
 * `/.well-known/oauth-authorization-server` (RFC 8414) con el mismo body.
 */
class OidcDiscoveryController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $issuer = rtrim((string) config('app.url'), '/');
        $scopes = array_keys((array) config('vout.scopes', []));

        // Grants realmente habilitados en Vout (Passport 13):
        //   - authorization_code, refresh_token, client_credentials → on por defecto.
        //   - device_code → on por defecto en Passport 13 (`$deviceCodeGrantEnabled`).
        //   - password / implicit → desactivados (Passport los marca off por defecto
        //     y Vout no los re-activa). No los publicamos para no mentir al cliente.
        $payload = [
            'issuer' => $issuer,
            'authorization_endpoint' => $issuer.'/oauth/authorize',
            'token_endpoint' => $issuer.'/oauth/token',
            'device_authorization_endpoint' => $issuer.'/oauth/device/code',
            'jwks_uri' => $issuer.'/oauth/jwks',
            'userinfo_endpoint' => $issuer.'/api/v1/user/me',

            'scopes_supported' => $scopes,
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
                'none', // PKCE flow para SPAs / juegos sin backend.
            ],
            'code_challenge_methods_supported' => ['S256'],
            'subject_types_supported' => ['public'],
            'id_token_signing_alg_values_supported' => ['RS256'],
            'service_documentation' => $issuer.'/developers/docs/integration-guide',
        ];

        return response()
            ->json($payload, options: JSON_UNESCAPED_SLASHES)
            ->header('Cache-Control', 'public, max-age=3600');
    }
}
