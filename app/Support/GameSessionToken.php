<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Token de identidad emitido para una sesión de juego embebido.
 *
 * Viaja al frontend como prop de Inertia (carga inicial) o como JSON
 * (renovación) y de ahí al iFrame exclusivamente por `postMessage`.
 * `expiresAt` coincide con el claim `exp` del JWT: el portal lo usa
 * para programar la renovación sin tener que decodificar el token.
 */
final readonly class GameSessionToken
{
    public function __construct(
        public string $token,
        public CarbonImmutable $expiresAt,
    ) {}

    /**
     * @return array{token: string, expires_at: int}
     */
    public function toArray(): array
    {
        return [
            'token' => $this->token,
            'expires_at' => $this->expiresAt->getTimestamp(),
        ];
    }
}
