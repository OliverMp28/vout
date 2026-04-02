<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Puebla el catálogo con juegos, desarrolladores e interacciones de usuario.
 *
 * Crea datos realistas para desarrollo y pruebas del portal.
 * Requiere que CategorySeeder se haya ejecutado previamente.
 */
class CatalogSeeder extends Seeder
{
    /**
     * Desarrolladores de ejemplo con identidad propia.
     *
     * @var list<array<string, string>>
     */
    private const DEVELOPERS = [
        ['name' => 'Pixel Forge Studio', 'slug' => 'pixel-forge-studio', 'bio' => 'Creadores de experiencias arcade retro con sabor moderno.', 'website_url' => 'https://pixelforge.example.com'],
        ['name' => 'NeuralPlay Labs', 'slug' => 'neuralplay-labs', 'bio' => 'Especializados en juegos controlados por visión artificial.', 'website_url' => 'https://neuralplay.example.com'],
        ['name' => 'Vout Games', 'slug' => 'vout-games', 'bio' => 'El equipo interno de Vout. Juegos nativos del portal.', 'website_url' => null],
        ['name' => 'BrainWave Interactive', 'slug' => 'brainwave-interactive', 'bio' => 'Puzzles y retos de lógica que entrenan tu mente.', 'website_url' => 'https://brainwave.example.com'],
        ['name' => 'SpeedRun Collective', 'slug' => 'speedrun-collective', 'bio' => 'Juegos diseñados para competición y récords de velocidad.', 'website_url' => 'https://speedrun.example.com'],
    ];

    /**
     * Catálogo de juegos con datos realistas para demostración.
     * Cada juego define sus categorías (slugs) y desarrollador asignado.
     *
     * @var list<array<string, mixed>>
     */
    private const GAMES = [
        // Acción
        ['name' => 'Astro Blaster', 'categories' => ['accion', 'arcade'], 'developer' => 'pixel-forge-studio', 'featured' => true, 'play_count' => 8420],
        ['name' => 'Shadow Dash', 'categories' => ['accion'], 'developer' => 'speedrun-collective', 'featured' => false, 'play_count' => 4100],
        ['name' => 'Neon Rampage', 'categories' => ['accion', 'arcade'], 'developer' => 'vout-games', 'featured' => true, 'play_count' => 6780],
        ['name' => 'Cyber Strike', 'categories' => ['accion'], 'developer' => 'speedrun-collective', 'featured' => false, 'play_count' => 2900],
        ['name' => 'Gravity Shift', 'categories' => ['accion', 'aventura'], 'developer' => 'pixel-forge-studio', 'featured' => false, 'play_count' => 3200],

        // Puzzle
        ['name' => 'Mind Maze', 'categories' => ['puzzle'], 'developer' => 'brainwave-interactive', 'featured' => true, 'play_count' => 9150],
        ['name' => 'Color Chain', 'categories' => ['puzzle', 'arcade'], 'developer' => 'brainwave-interactive', 'featured' => false, 'play_count' => 5300],
        ['name' => 'Logic Grid Pro', 'categories' => ['puzzle', 'estrategia'], 'developer' => 'brainwave-interactive', 'featured' => false, 'play_count' => 3800],
        ['name' => 'Tile Twist', 'categories' => ['puzzle'], 'developer' => 'vout-games', 'featured' => false, 'play_count' => 2100],
        ['name' => 'Number Flow', 'categories' => ['puzzle', 'estrategia'], 'developer' => 'brainwave-interactive', 'featured' => false, 'play_count' => 1700],

        // Aventura
        ['name' => 'Lost Worlds', 'categories' => ['aventura'], 'developer' => 'pixel-forge-studio', 'featured' => true, 'play_count' => 7200],
        ['name' => 'Sky Explorer', 'categories' => ['aventura', 'accion'], 'developer' => 'neuralplay-labs', 'featured' => false, 'play_count' => 4600],
        ['name' => 'Cave Runner', 'categories' => ['aventura', 'arcade'], 'developer' => 'vout-games', 'featured' => false, 'play_count' => 3400],
        ['name' => 'Ocean Quest', 'categories' => ['aventura'], 'developer' => 'pixel-forge-studio', 'featured' => false, 'play_count' => 2800],
        ['name' => 'Desert Wanderer', 'categories' => ['aventura', 'estrategia'], 'developer' => 'speedrun-collective', 'featured' => false, 'play_count' => 1900],

        // Deportes
        ['name' => 'Turbo Kart', 'categories' => ['deportes', 'arcade'], 'developer' => 'speedrun-collective', 'featured' => true, 'play_count' => 10200],
        ['name' => 'Slam Dunk King', 'categories' => ['deportes'], 'developer' => 'vout-games', 'featured' => false, 'play_count' => 4900],
        ['name' => 'Freestyle Ski', 'categories' => ['deportes', 'accion'], 'developer' => 'pixel-forge-studio', 'featured' => false, 'play_count' => 3100],
        ['name' => 'Ping Pong Master', 'categories' => ['deportes', 'arcade'], 'developer' => 'neuralplay-labs', 'featured' => false, 'play_count' => 6800],

        // Estrategia
        ['name' => 'Tower Defense X', 'categories' => ['estrategia'], 'developer' => 'brainwave-interactive', 'featured' => true, 'play_count' => 5600],
        ['name' => 'Kingdom Builder', 'categories' => ['estrategia', 'aventura'], 'developer' => 'brainwave-interactive', 'featured' => false, 'play_count' => 4200],
        ['name' => 'Space Conquest', 'categories' => ['estrategia', 'accion'], 'developer' => 'pixel-forge-studio', 'featured' => false, 'play_count' => 3700],

        // Arcade
        ['name' => 'Retro Invaders', 'categories' => ['arcade', 'accion'], 'developer' => 'pixel-forge-studio', 'featured' => true, 'play_count' => 12000],
        ['name' => 'Bubble Pop', 'categories' => ['arcade'], 'developer' => 'vout-games', 'featured' => false, 'play_count' => 8900],
        ['name' => 'Coin Rush', 'categories' => ['arcade'], 'developer' => 'speedrun-collective', 'featured' => false, 'play_count' => 6400],
        ['name' => 'Snake Evolved', 'categories' => ['arcade'], 'developer' => 'neuralplay-labs', 'featured' => false, 'play_count' => 9700],

        // Control gestual (NeuralPlay especializados)
        ['name' => 'Face Racer', 'categories' => ['accion', 'deportes'], 'developer' => 'neuralplay-labs', 'featured' => true, 'play_count' => 3200],
        ['name' => 'Blink Dodge', 'categories' => ['arcade', 'accion'], 'developer' => 'neuralplay-labs', 'featured' => false, 'play_count' => 2800],
        ['name' => 'Head Ball', 'categories' => ['deportes', 'arcade'], 'developer' => 'neuralplay-labs', 'featured' => false, 'play_count' => 4100],
        ['name' => 'Wink Warrior', 'categories' => ['accion', 'arcade'], 'developer' => 'neuralplay-labs', 'featured' => false, 'play_count' => 1900],
    ];

    /**
     * Puebla desarrolladores, juegos y sus relaciones.
     */
    public function run(): void
    {
        $developers = $this->createDevelopers();
        $categories = Category::query()->pluck('id', 'slug');
        $this->createGames($developers, $categories);
        $this->createUserInteractions();
    }

    /**
     * Crea los desarrolladores definidos en la constante.
     *
     * @return array<string, Developer>
     */
    private function createDevelopers(): array
    {
        $developers = [];

        foreach (self::DEVELOPERS as $data) {
            $developers[$data['slug']] = Developer::query()->firstOrCreate(
                ['slug' => $data['slug']],
                [
                    'name' => $data['name'],
                    'bio' => $data['bio'],
                    'website_url' => $data['website_url'],
                    'logo_url' => null,
                ],
            );
        }

        return $developers;
    }

    /**
     * Crea los juegos con sus relaciones a categorías y desarrolladores.
     *
     * @param  array<string, Developer>  $developers
     * @param  Collection<string, int>  $categories
     */
    private function createGames(array $developers, Collection $categories): void
    {
        foreach (self::GAMES as $data) {
            $game = Game::query()->firstOrCreate(
                ['slug' => Str::slug($data['name'])],
                [
                    'name' => $data['name'],
                    'description' => fake()->paragraph(3),
                    'embed_url' => 'https://games.example.com/play/'.Str::slug($data['name']),
                    'cover_image' => null,
                    'release_date' => fake()->dateTimeBetween('-2 years', 'now')->format('Y-m-d'),
                    'play_count' => $data['play_count'],
                    'is_active' => true,
                    'is_featured' => $data['featured'],
                ],
            );

            // Asociar categorías (many-to-many)
            $categoryIds = collect($data['categories'])
                ->map(fn (string $slug): mixed => $categories->get($slug))
                ->filter()
                ->values()
                ->all();

            $game->categories()->sync($categoryIds);

            // Asociar desarrollador principal
            if (isset($developers[$data['developer']])) {
                $game->developers()->syncWithoutDetaching([
                    $developers[$data['developer']]->id => ['role' => 'Desarrollador Principal'],
                ]);
            }
        }
    }

    /**
     * Crea interacciones del usuario de prueba con el catálogo.
     *
     * Simula un usuario activo con favoritos, guardados y partidas jugadas.
     */
    private function createUserInteractions(): void
    {
        $testUser = User::query()->where('email', 'test@example.com')->first();

        if (! $testUser) {
            return;
        }

        $games = Game::query()->active()->inRandomOrder()->limit(20)->get();

        foreach ($games as $index => $game) {
            $testUser->games()->syncWithoutDetaching([
                $game->id => [
                    'is_favorite' => $index < 5,
                    'is_saved' => $index < 10,
                    'play_count' => fake()->numberBetween(1, 50),
                    'best_score' => fake()->optional(0.7)->numberBetween(100, 99999),
                    'last_played_at' => fake()->dateTimeBetween('-30 days', 'now'),
                ],
            ]);
        }
    }
}
