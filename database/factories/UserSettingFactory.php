<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserSetting>
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
            'appearance' => 'system',
            'show_mascot' => true,
            'gestures_enabled' => false,
        ];
    }

    /**
     * Estado: usuario con tema oscuro forzado.
     */
    public function darkMode(): static
    {
        return $this->state(fn (array $attributes): array => [
            'appearance' => 'dark',
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
