<?php

namespace Database\Factories;

use App\Models\Passport\Client;
use App\Models\RegisteredApp;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<RegisteredApp>
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
            'user_id' => null,
            'name' => ucwords($name),
            'slug' => Str::slug($name),
            'app_url' => fake()->url(),
            'allowed_origins' => [fake()->url(), fake()->url()],
            'is_active' => true,
            'oauth_client_id' => null,
            'is_first_party' => false,
            'requires_auth' => true,
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

    /**
     * Estado: app vinculada a un usuario propietario (Developer Portal).
     */
    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes): array => [
            'user_id' => $user->id,
        ]);
    }

    /**
     * Estado: app suspendida por un admin con motivo y timestamp.
     */
    public function suspended(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
            'suspended_at' => now(),
            'suspension_reason' => 'Violación de términos de servicio (test).',
        ]);
    }

    /**
     * Estado: la app crea también un Passport Client real y lo enlaza
     * via `oauth_client_id`. Útil para tests del flujo de regeneración
     * de secreto y de revocación.
     */
    public function withClient(): static
    {
        return $this->afterCreating(function ($app): void {
            $client = Client::create([
                'id' => (string) Str::uuid(),
                'owner_type' => $app->user_id ? User::class : null,
                'owner_id' => $app->user_id,
                'name' => $app->name,
                'secret' => Str::random(40),
                'redirect_uris' => json_encode([$app->app_url]),
                'grant_types' => json_encode(['authorization_code', 'refresh_token']),
                'revoked' => false,
            ]);

            $app->forceFill(['oauth_client_id' => $client->id])->save();
        });
    }
}
