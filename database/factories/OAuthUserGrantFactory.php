<?php

namespace Database\Factories;

use App\Models\OAuthUserGrant;
use App\Models\Passport\Client;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OAuthUserGrant>
 */
class OAuthUserGrantFactory extends Factory
{
    protected $model = OAuthUserGrant::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'client_id' => null,
            'scopes' => ['user:read'],
            'granted_at' => now(),
            'updated_scopes_at' => null,
            'revoked_at' => null,
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn (array $attributes): array => [
            'user_id' => $user->id,
        ]);
    }

    public function forClient(Client $client): static
    {
        return $this->state(fn (array $attributes): array => [
            'client_id' => $client->id,
        ]);
    }

    /**
     * @param  array<int, string>  $scopes
     */
    public function withScopes(array $scopes): static
    {
        return $this->state(fn (array $attributes): array => [
            'scopes' => $scopes,
        ]);
    }

    public function revoked(): static
    {
        return $this->state(fn (array $attributes): array => [
            'revoked_at' => now(),
        ]);
    }
}
