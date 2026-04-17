<?php

use App\Models\Developer;
use App\Models\User;

use function Pest\Laravel\actingAs;

it('permite al dev reclamar su ficha pública', function (): void {
    $user = User::factory()->create();

    actingAs($user)
        ->post(route('developers.profile.store'), [
            'name' => 'Aurora Studios',
            'website_url' => 'https://aurora.test',
            'bio' => 'Indie studio por Aurora.',
            'logo_url' => 'https://cdn.aurora.test/logo.png',
        ])
        ->assertRedirect(route('developers.profile.edit'));

    $developer = Developer::query()
        ->where('user_id', $user->id)
        ->firstOrFail();

    expect($developer->name)->toBe('Aurora Studios')
        ->and($developer->slug)->toBe('aurora-studios')
        ->and($developer->bio)->toBe('Indie studio por Aurora.')
        ->and($developer->website_url)->toBe('https://aurora.test');
});

it('rechaza el segundo reclamo del mismo user con 409', function (): void {
    $user = User::factory()->create();
    Developer::factory()->create(['user_id' => $user->id, 'name' => 'Mine']);

    actingAs($user)
        ->post(route('developers.profile.store'), [
            'name' => 'Second Attempt',
        ])
        ->assertStatus(409);
});

it('rechaza un nombre ya tomado por otra ficha', function (): void {
    Developer::factory()->create(['name' => 'Taken Name']);
    $user = User::factory()->create();

    actingAs($user)
        ->post(route('developers.profile.store'), [
            'name' => 'Taken Name',
        ])
        ->assertSessionHasErrors('name');
});

it('exige un nombre válido entre 2 y 150 caracteres', function (): void {
    $user = User::factory()->create();

    actingAs($user)
        ->post(route('developers.profile.store'), ['name' => 'a'])
        ->assertSessionHasErrors('name');
});

it('genera slugs únicos cuando el nombre colisiona con una ficha manual previa', function (): void {
    Developer::factory()->create(['name' => 'Echo', 'slug' => 'echo', 'user_id' => null]);
    $user = User::factory()->create();

    actingAs($user)
        ->post(route('developers.profile.store'), ['name' => 'Echo'])
        ->assertSessionHasErrors('name');
});

it('requiere autenticación', function (): void {
    $this->post(route('developers.profile.store'), ['name' => 'Anon'])
        ->assertRedirect(route('login'));
});
