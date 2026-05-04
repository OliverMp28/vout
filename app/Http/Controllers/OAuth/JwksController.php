<?php

namespace App\Http\Controllers\OAuth;

use App\Http\Controllers\Controller;
use App\Support\Jwks;
use Illuminate\Http\JsonResponse;

/**
 * `GET /oauth/jwks` — JSON Web Key Set público (RFC 7517).
 *
 * Lista las claves con las que Vout firma sus Access Tokens. Cualquier
 * Resource Server del ecosistema descarga este documento, lo cachea
 * (respetando `Cache-Control`) y verifica los JWT entrantes localmente
 * sin volver a consultar Vout — alta escalabilidad, validación stateless.
 *
 * Cabeceras:
 *   - `Cache-Control: public, max-age=3600` para permitir cache por
 *     CDN/proxies y reducir tráfico.
 *   - `Content-Type: application/jwk-set+json` (RFC 7517 §8.5.1).
 */
class JwksController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $payload = ['keys' => [Jwks::publicJwk()]];

        return response()
            ->json($payload, options: JSON_UNESCAPED_SLASHES)
            ->header('Content-Type', 'application/jwk-set+json')
            ->header('Cache-Control', 'public, max-age=3600');
    }
}
