<?php

use App\Models\AuditLog;
use App\Models\Developer;
use App\Models\Game;
use App\Models\User;

// ── Index ───────────────────────────────────────────────────────────

it('admin ve todos los developers con conteo de juegos', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = Developer::factory()->create();
    Game::factory()->count(2)->hasAttached($dev)->create();

    $response = $this->actingAs($admin)
        ->get(route('admin.developers.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/developers/index', false)
        ->has('developers.data', 1)
        ->where('developers.data.0.games_count', 2)
    );
});

it('busca developers por nombre', function (): void {
    $admin = User::factory()->admin()->create();
    Developer::factory()->create(['name' => 'Vout Studios']);
    Developer::factory()->create(['name' => 'Indie Lab']);

    $response = $this->actingAs($admin)
        ->get(route('admin.developers.index', ['search' => 'Vout']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->has('developers.data', 1));
});

it('rechaza a usuarios no admin en index', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.developers.index'))
        ->assertForbidden();
});

// ── Create / Store ──────────────────────────────────────────────────

it('admin ve el formulario de crear developer', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get(route('admin.developers.create'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('admin/developers/create', false));
});

it('admin crea un developer con todos los campos', function (): void {
    $admin = User::factory()->admin()->create();

    $response = $this->actingAs($admin)
        ->post(route('admin.developers.store'), [
            'name' => 'Vout Studios',
            'website_url' => 'https://vout.dev',
            'bio' => 'Game development studio.',
            'logo_url' => 'https://vout.dev/logo.png',
        ]);

    $response->assertRedirectToRoute('admin.developers.index');

    $this->assertDatabaseHas('developers', [
        'name' => 'Vout Studios',
        'slug' => 'vout-studios',
        'website_url' => 'https://vout.dev',
    ]);

    expect(AuditLog::where('action', 'developer.created')->exists())->toBeTrue();
});

it('admin crea un developer solo con nombre (campos opcionales nulos)', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->post(route('admin.developers.store'), ['name' => 'Solo Nombre'])
        ->assertRedirectToRoute('admin.developers.index');

    $this->assertDatabaseHas('developers', [
        'name' => 'Solo Nombre',
        'slug' => 'solo-nombre',
        'website_url' => null,
        'bio' => null,
        'logo_url' => null,
    ]);
});

it('rechaza nombre duplicado al crear developer', function (): void {
    $admin = User::factory()->admin()->create();
    Developer::factory()->create(['name' => 'Existing']);

    $this->actingAs($admin)
        ->post(route('admin.developers.store'), ['name' => 'Existing'])
        ->assertSessionHasErrors('name');
});

it('rechaza website_url inválida', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->post(route('admin.developers.store'), [
            'name' => 'Test Dev',
            'website_url' => 'not-a-url',
        ])
        ->assertSessionHasErrors('website_url');
});

// ── Edit / Update ───────────────────────────────────────────────────

it('admin ve el formulario de editar developer', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = Developer::factory()->create();

    $this->actingAs($admin)
        ->get(route('admin.developers.edit', $dev))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/developers/edit', false)
            ->has('developer')
        );
});

it('admin actualiza un developer y regenera slug', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = Developer::factory()->create(['name' => 'Old Studio', 'slug' => 'old-studio']);

    $this->actingAs($admin)
        ->put(route('admin.developers.update', $dev), [
            'name' => 'New Studio',
            'website_url' => 'https://new.studio',
            'bio' => 'Updated bio.',
            'logo_url' => null,
        ])
        ->assertRedirect();

    $dev->refresh();
    expect($dev->name)->toBe('New Studio');
    expect($dev->slug)->toBe('new-studio');
    expect($dev->website_url)->toBe('https://new.studio');
    expect(AuditLog::where('action', 'developer.updated')->exists())->toBeTrue();
});

it('permite guardar developer con el mismo nombre (ignore self)', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = Developer::factory()->create(['name' => 'My Studio']);

    $this->actingAs($admin)
        ->put(route('admin.developers.update', $dev), ['name' => 'My Studio'])
        ->assertRedirect();
});

// ── Destroy ─────────────────────────────────────────────────────────

it('admin elimina un developer sin juegos', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = Developer::factory()->create();

    $this->actingAs($admin)
        ->delete(route('admin.developers.destroy', $dev))
        ->assertRedirectToRoute('admin.developers.index');

    $this->assertDatabaseMissing('developers', ['id' => $dev->id]);
    expect(AuditLog::where('action', 'developer.destroyed')->exists())->toBeTrue();
});

it('bloquea eliminar developer con juegos asociados', function (): void {
    $admin = User::factory()->admin()->create();
    $dev = Developer::factory()->create();
    Game::factory()->hasAttached($dev)->create();

    $this->actingAs($admin)
        ->delete(route('admin.developers.destroy', $dev))
        ->assertStatus(422);

    $this->assertDatabaseHas('developers', ['id' => $dev->id]);
});
