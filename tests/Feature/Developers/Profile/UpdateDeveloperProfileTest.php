<?php

use App\Models\Developer;
use App\Models\User;

use function Pest\Laravel\actingAs;

it('actualiza los campos editables de la ficha del dev', function (): void {
    $user = User::factory()->create();
    $profile = Developer::factory()->create([
        'user_id' => $user->id,
        'name' => 'Original',
    ]);

    actingAs($user)
        ->put(route('developers.profile.update'), [
            'name' => 'Renamed Studio',
            'website_url' => 'https://renamed.test',
            'bio' => 'Nueva bio.',
            'logo_url' => null,
        ])
        ->assertRedirect(route('developers.profile.edit'));

    $profile->refresh();

    expect($profile->name)->toBe('Renamed Studio')
        ->and($profile->slug)->toBe('renamed-studio')
        ->and($profile->bio)->toBe('Nueva bio.')
        ->and($profile->website_url)->toBe('https://renamed.test');
});

it('preserva el slug si el nombre no cambia', function (): void {
    $user = User::factory()->create();
    $profile = Developer::factory()->create([
        'user_id' => $user->id,
        'name' => 'Stable',
        'slug' => 'stable',
    ]);

    actingAs($user)
        ->put(route('developers.profile.update'), [
            'name' => 'Stable',
            'bio' => 'Sólo cambio bio',
        ]);

    expect($profile->fresh()->slug)->toBe('stable');
});

it('permite al dev reutilizar su propio nombre actual sin error de unicidad', function (): void {
    $user = User::factory()->create();
    Developer::factory()->create([
        'user_id' => $user->id,
        'name' => 'Mine',
    ]);

    actingAs($user)
        ->put(route('developers.profile.update'), [
            'name' => 'Mine',
            'bio' => 'Sólo toco la bio',
        ])
        ->assertSessionHasNoErrors();
});

it('rechaza un nombre ya tomado por otra ficha', function (): void {
    Developer::factory()->create(['name' => 'Taken']);
    $user = User::factory()->create();
    Developer::factory()->create(['user_id' => $user->id, 'name' => 'Mine']);

    actingAs($user)
        ->put(route('developers.profile.update'), ['name' => 'Taken'])
        ->assertSessionHasErrors('name');
});

it('devuelve 404 si el user aún no tiene ficha', function (): void {
    $user = User::factory()->create();

    actingAs($user)
        ->put(route('developers.profile.update'), ['name' => 'Whatever'])
        ->assertStatus(404);
});
