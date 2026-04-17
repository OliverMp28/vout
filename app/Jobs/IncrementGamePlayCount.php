<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Database\Query\Expression;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Fase 3.4 — Registra una partida jugada por el usuario.
 *
 * Incrementa `play_count` y actualiza `last_played_at` en la tabla pivote
 * `game_user`. Si el usuario aún no tiene fila pivote para el juego, la crea.
 *
 * No implementa `ShouldQueue`: se despacha con `dispatchAfterResponse()` para
 * no bloquear la respuesta HTTP del reproductor y funcionar sin un worker
 * de cola activo.
 */
class IncrementGamePlayCount
{
    use Queueable;

    public function __construct(
        private readonly int $userId,
        private readonly int $gameId,
    ) {}

    public function handle(): void
    {
        $user = User::find($this->userId);

        if ($user === null) {
            return;
        }

        $hasPivot = $user->games()
            ->wherePivot('game_id', $this->gameId)
            ->exists();

        if ($hasPivot) {
            $user->games()->updateExistingPivot($this->gameId, [
                'play_count' => new Expression('play_count + 1'),
                'last_played_at' => now(),
            ]);

            return;
        }

        $user->games()->attach($this->gameId, [
            'play_count' => 1,
            'last_played_at' => now(),
        ]);
    }
}
