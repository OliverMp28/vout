<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\UserSetting>
 */
class UserSettingFactory extends Factory
{
    /**
     * Genera configuración de usuario con valores por defecto sensatos.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'dark_mode' => false,
            'show_mascot' => true,
            'gestures_enabled' => false,
        ];
    }

    /**
     * Estado: usuario con modo oscuro activado.
     */
    public function darkMode(): static
    {
        return $this->state(fn (array $attributes): array => [
            'dark_mode' => true,
        ]);
    }

    /**
     * Estado: usuario con gestos faciales habilitados.
     */
    public function withGestures(): static
    {
        return $this->state(fn (array $attributes): array => [
            'gestures_enabled' => true,
        ]);
    }
}
