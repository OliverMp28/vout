<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\RegisteredApp>
 */
class RegisteredAppFactory extends Factory
{
    /**
     * Genera una aplicación externa registrada para SSO.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'name' => ucwords($name),
            'slug' => Str::slug($name),
            'app_url' => fake()->url(),
            'allowed_origins' => [fake()->url(), fake()->url()],
            'is_active' => true,
        ];
    }

    /**
     * Estado: aplicación desactivada (no puede usar SSO).
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
        ]);
    }
}
