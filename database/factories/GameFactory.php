<?php

namespace Database\Factories;

use App\Enums\GameStatus;
use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Game>
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
            'submitted_by_user_id' => null,
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
            'status' => GameStatus::Published,
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

    /**
     * Estado: juego en borrador privado del desarrollador (Developer Portal).
     */
    public function draft(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => GameStatus::Draft,
        ]);
    }

    /**
     * Estado: juego enviado a revisión, aún no visible en el catálogo público.
     */
    public function pendingReview(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => GameStatus::PendingReview,
        ]);
    }

    /**
     * Estado: juego rechazado en revisión, editable y reenviable.
     */
    public function rejected(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => GameStatus::Rejected,
        ]);
    }

    /**
     * Estado: juego enviado por el usuario indicado (Developer Portal).
     */
    public function submittedBy(User $user): static
    {
        return $this->state(fn (array $attributes): array => [
            'submitted_by_user_id' => $user->id,
        ]);
    }
}
