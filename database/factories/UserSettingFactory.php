<?php

namespace Database\Factories;

use App\Enums\FacialControlUsage;
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
            'facial_control_usage' => FacialControlUsage::Off,
            'camera_autostart' => false,
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
     * Estado: usuario que usa la cámara a veces.
     */
    public function occasionalCamera(): static
    {
        return $this->state(fn (array $attributes): array => [
            'facial_control_usage' => FacialControlUsage::Occasional,
            'camera_autostart' => false,
        ]);
    }

    /**
     * Estado: usuario que juega con la cámara (y, si lo autoriza, quiere que
     * se encienda sola en los juegos compatibles).
     */
    public function primaryCamera(bool $autostart = false): static
    {
        return $this->state(fn (array $attributes): array => [
            'facial_control_usage' => FacialControlUsage::Primary,
            'camera_autostart' => $autostart,
        ]);
    }
}
