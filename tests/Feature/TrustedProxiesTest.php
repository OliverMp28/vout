<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
 * En producción Vout va detrás de Cloudflare Tunnel + el proxy de Coolify:
 * HTTPS termina fuera del contenedor y la petición llega por HTTP desde una
 * IP de la red Docker. Laravel debe fiarse de `X-Forwarded-*` sólo cuando
 * vienen de una red privada.
 */

beforeEach(function (): void {
    Route::get('/_test/proxy', fn (Request $request): array => [
        'secure' => $request->isSecure(),
        'ip' => $request->ip(),
        'url' => url('/games'),
    ]);
});

it('detecta https y la IP real cuando la petición llega desde un proxy de la red interna', function (): void {
    $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.4'])
        ->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-For' => '203.0.113.7',
            'X-Forwarded-Host' => 'vout.tech',
            'X-Forwarded-Port' => '443',
        ])
        ->get('/_test/proxy')
        ->assertOk()
        ->assertExactJson([
            'secure' => true,
            'ip' => '203.0.113.7',
            'url' => 'https://vout.tech/games',
        ]);
});

it('ignora las cabeceras X-Forwarded-* que llegan desde una IP pública', function (): void {
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.9'])
        ->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-For' => '203.0.113.7',
        ])
        ->get('/_test/proxy')
        ->assertOk()
        ->assertJson([
            'secure' => false,
            'ip' => '198.51.100.9',
        ]);
});
