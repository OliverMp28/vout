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
 * 2. El juego envía READY con suggestedPreset='platformer' (y lo repite
 *    hasta recibir respuesta).
 * 3. useIframeHandshake valida el origen (http://localhost) y responde VOUT_AUTH.
 * 4. El juego muestra el nombre de usuario, el vout_id y la expiración del
 *    token. Al no tener app OAuth, recibe el token de portal (`game:play`).
 * 5. Si el usuario activa el motor de visión, los gestos llegan como:
 *    - KEYDOWN/KEYUP para acciones de teclado (solo porque el juego de
 *      prueba comparte origen con el portal; a un juego externo no le llegan).
 *    - VOUT_ACTION / VOUT_ACTION_END para el inicio y el fin de game_events.
 *    - VOUT_CURSOR (x, y) para el modo cursor.
 * 6. Alt-Tab fuera de la ventana → no deben quedar teclas bloqueadas.
 * 7. Unos 5 minutos antes de caducar el token llega otro VOUT_AUTH (renovación).
 *    Si la renovación ya no es posible, llega VOUT_SESSION_END.
 * 8. El botón "Salir" del juego envía EXIT y el portal vuelve al catálogo.
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
