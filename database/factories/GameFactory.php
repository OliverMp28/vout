<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Game>
 */
class GameFactory extends Factory
{
    /**
     * Genera un juego con datos de catálogo realistas.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'name' => ucwords($name),
            'slug' => Str::slug($name),
            'description' => fake()->paragraph(),
            'repo_url' => fake()->optional()->url(),
            'cover_image' => fake()->optional()->imageUrl(640, 480, 'games'),
            'embed_url' => fake()->url(),
            'release_date' => fake()->optional()->date(),
            'play_count' => fake()->numberBetween(0, 10000),
            'is_active' => true,
            'is_featured' => false,
        ];
    }

    /**
     * Estado: juego desactivado (no visible en el catálogo).
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
        ]);
    }

    /**
     * Estado: juego destacado (mostrado en la portada).
     */
    public function featured(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_featured' => true,
        ]);
    }
}
