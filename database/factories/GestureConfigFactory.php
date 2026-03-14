<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GestureConfig>
 */
class GestureConfigFactory extends Factory
{
    /**
     * Genera un perfil de configuración de gestos con mapeo de ejemplo.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'profile_name' => fake()->words(2, true),
            'detection_mode' => fake()->randomElement(['face_landmarks', 'face_mesh']),
            'sensitivity' => fake()->numberBetween(1, 10),
            'gesture_mapping' => [
                'BROW_RAISE' => 'JUMP',
                'MOUTH_OPEN' => 'SHOOT',
                'HEAD_TILT_LEFT' => 'MOVE_LEFT',
                'HEAD_TILT_RIGHT' => 'MOVE_RIGHT',
            ],
            'is_active' => false,
        ];
    }

    /**
     * Estado: perfil de gestos activo.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => true,
        ]);
    }
}
