<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Developer>
 */
class DeveloperFactory extends Factory
{
    /**
     * Genera un desarrollador con datos de perfil realistas.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'website_url' => fake()->optional()->url(),
            'bio' => fake()->optional()->paragraph(),
            'logo_url' => fake()->optional()->imageUrl(200, 200, 'business'),
        ];
    }
}
