<?php

namespace Database\Factories;

use App\Models\GestureConfig;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GestureConfig>
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
            'detection_mode' => 'face_landmarks',
            'sensitivity' => fake()->numberBetween(1, 10),
            // Formato GameAction enriquecido (Sesión 3 — 3.2).
            // Los keys deben coincidir con GestureType o HeadDirectionType del frontend.
            'gesture_mapping' => [
                'BROW_RAISE' => ['type' => 'keyboard', 'key' => 'Space', 'mode' => 'press'],
                'MOUTH_OPEN' => ['type' => 'keyboard', 'key' => 'ArrowUp', 'mode' => 'press'],
            ],
            'head_tracking_mode' => 'cursor',
            'is_active' => false,
        ];
    }

    /**
     * Estado: perfil de gestos activo.
     */
    public function active(): static
    {
        return $this->state(fn (): array => [
            'is_active' => true,
        ]);
    }
}
