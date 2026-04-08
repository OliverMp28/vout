<?php

namespace Database\Seeders;

use App\Models\Game;
use Illuminate\Database\Seeder;

/**
 * Crea el juego de prueba que sirve el handshake E2E completo.
 *
 * ─── Uso ──────────────────────────────────────────────────────────────────
 * Solo para entornos de desarrollo. Requiere que exista el archivo estático:
 *   public/test-game/index.html
 *
 * Para insertarlo en la BD de dev:
 *   vendor/bin/sail artisan db:seed --class=TestGameSeeder
 *
 * Para probarlo, navegar a /play/test-game con un usuario autenticado.
 *
 * ─── Flujo de prueba E2E ──────────────────────────────────────────────────
 * 1. El iframe carga http://localhost/test-game/index.html.
 * 2. El juego envía READY con suggestedPreset='platformer'.
 * 3. useIframeHandshake valida el origen (http://localhost) y responde VOUT_AUTH.
 * 4. El juego muestra el nombre de usuario y el vout_id.
 * 5. Si el usuario activa el motor de visión, los gestos llegan como:
 *    - KEYDOWN/KEYUP para acciones de teclado.
 *    - VOUT_ACTION para game_events.
 *    - VOUT_CURSOR (x, y) para el modo cursor.
 * 6. Alt-Tab fuera de la ventana → no deben quedar teclas bloqueadas.
 *
 * ─── Idempotencia ─────────────────────────────────────────────────────────
 * Usa firstOrCreate para no duplicar el juego si se ejecuta varias veces.
 */
class TestGameSeeder extends Seeder
{
    public function run(): void
    {
        Game::query()->firstOrCreate(
            ['slug' => 'test-game'],
            [
                'name' => 'Test Game (Dev)',
                'description' => 'Página de prueba para validar el handshake READY → VOUT_AUTH y el despacho de acciones. Solo visible en entornos de desarrollo.',
                'embed_url' => 'http://localhost/test-game/index.html',
                'cover_image' => null,
                'release_date' => now()->toDateString(),
                'play_count' => 0,
                'is_active' => true,
                'is_featured' => false,
            ],
        );

        $this->command?->info('Juego de prueba `test-game` registrado → /play/test-game');
    }
}
