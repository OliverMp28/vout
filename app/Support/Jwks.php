<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * Construye el JWK público a partir de `storage/oauth-public.key`
 * (la clave pública RSA de Passport) cumpliendo:
 *
 *   - RFC 7517 — JSON Web Key.
 *   - RFC 7518 §6.3 — RSA public key parameters (`n`, `e`).
 *   - RFC 7638 — JWK Thumbprint para derivar un `kid` estable y
 *     verificable por cualquier consumidor sin acoplarse a Vout.
 *
 * Memoriza el resultado en cache (1h por defecto) porque la clave es
 * efectivamente inmutable entre rotaciones, y la conversión PEM→JWK se
 * hace en cada GET a `/oauth/jwks`. Cuando rotes la clave en disco,
 * borra esta cache (`php artisan cache:forget vout.jwks.public`).
 */
class Jwks
{
    private const CACHE_KEY = 'vout.jwks.public';

    private const CACHE_TTL_SECONDS = 3600;

    /**
     * Devuelve el JWK público completo (con `kid`).
     *
     * @return array{kty: string, use: string, alg: string, kid: string, n: string, e: string}
     */
    public static function publicJwk(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached)) {
            /** @var array{kty: string, use: string, alg: string, kid: string, n: string, e: string} $cached */
            return $cached;
        }

        $jwk = self::buildJwk();
        Cache::put(self::CACHE_KEY, $jwk, self::CACHE_TTL_SECONDS);

        return $jwk;
    }

    /**
     * `kid` derivado del thumbprint del JWK (RFC 7638). Cualquier
     * consumidor puede recomputarlo y verificar que coincide.
     */
    public static function keyId(): string
    {
        return self::publicJwk()['kid'];
    }

    /**
     * Limpia la caché. Útil tras rotar `oauth-public.key`.
     */
    public static function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @return array{kty: string, use: string, alg: string, kid: string, n: string, e: string}
     */
    private static function buildJwk(): array
    {
        $path = storage_path('oauth-public.key');
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException(
                'OAuth public key not found at '.$path.'. '
                .'Run `php artisan passport:keys` to generate Passport keys.'
            );
        }

        $pem = file_get_contents($path);
        if ($pem === false || $pem === '') {
            throw new RuntimeException('OAuth public key is empty.');
        }

        $resource = openssl_pkey_get_public($pem);
        if ($resource === false) {
            throw new RuntimeException('Failed to parse OAuth public key (is it valid PEM?).');
        }

        $details = openssl_pkey_get_details($resource);
        if ($details === false || ! isset($details['type'], $details['rsa']['n'], $details['rsa']['e'])) {
            throw new RuntimeException('OAuth public key is not an RSA key — JWKS requires RSA.');
        }

        if ($details['type'] !== OPENSSL_KEYTYPE_RSA) {
            throw new RuntimeException('OAuth public key must be RSA (got type '.$details['type'].').');
        }

        $n = self::base64UrlEncode($details['rsa']['n']);
        $e = self::base64UrlEncode($details['rsa']['e']);
        $kid = self::computeThumbprint($n, $e);

        return [
            'kty' => 'RSA',
            'use' => 'sig',
            'alg' => 'RS256',
            'kid' => $kid,
            'n' => $n,
            'e' => $e,
        ];
    }

    /**
     * Calcula el thumbprint RFC 7638. Los miembros del JWK requeridos
     * para RSA son `e`, `kty`, `n` en orden lexicográfico, sin espacios.
     * El hash SHA-256 sobre esa cadena, codificado base64url, **es** el
     * `kid` canónico — cualquier librería JWT compatible llega al mismo
     * valor partiendo solo del JWK.
     */
    private static function computeThumbprint(string $n, string $e): string
    {
        $canonical = sprintf(
            '{"e":"%s","kty":"RSA","n":"%s"}',
            $e,
            $n,
        );

        return self::base64UrlEncode(hash('sha256', $canonical, true));
    }

    private static function base64UrlEncode(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
