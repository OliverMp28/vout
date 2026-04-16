<?php

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Game;
use App\Models\User;

// ── Index ───────────────────────────────────────────────────────────

it('admin ve todas las categorías con conteo de juegos', function (): void {
    $admin = User::factory()->admin()->create();
    $cat = Category::factory()->create();
    Game::factory()->count(3)->hasAttached($cat)->create();

    $response = $this->actingAs($admin)
        ->get(route('admin.categories.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/categories/index', false)
        ->has('categories.data', 1)
        ->where('categories.data.0.games_count', 3)
    );
});

it('busca categorías por nombre', function (): void {
    $admin = User::factory()->admin()->create();
    Category::factory()->create(['name' => 'Acción']);
    Category::factory()->create(['name' => 'Puzzle']);

    $response = $this->actingAs($admin)
        ->get(route('admin.categories.index', ['search' => 'Acción']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->has('categories.data', 1));
});

it('rechaza a usuarios no admin en index', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.categories.index'))
        ->assertForbidden();
});

// ── Create / Store ──────────────────────────────────────────────────

it('admin ve el formulario de crear categoría', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get(route('admin.categories.create'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('admin/categories/create', false));
});

it('admin crea una categoría con slug autogenerado', function (): void {
    $admin = User::factory()->admin()->create();

    $response = $this->actingAs($admin)
        ->post(route('admin.categories.store'), ['name' => 'Juegos de Mesa']);

    $response->assertRedirectToRoute('admin.categories.index');

    $this->assertDatabaseHas('categories', [
        'name' => 'Juegos de Mesa',
        'slug' => 'juegos-de-mesa',
    ]);

    expect(AuditLog::where('action', 'category.created')->exists())->toBeTrue();
});

it('rechaza nombre duplicado al crear', function (): void {
    $admin = User::factory()->admin()->create();
    Category::factory()->create(['name' => 'Acción']);

    $this->actingAs($admin)
        ->post(route('admin.categories.store'), ['name' => 'Acción'])
        ->assertSessionHasErrors('name');
});

it('rechaza nombre demasiado corto', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->post(route('admin.categories.store'), ['name' => 'A'])
        ->assertSessionHasErrors('name');
});

// ── Edit / Update ───────────────────────────────────────────────────

it('admin ve el formulario de editar categoría', function (): void {
    $admin = User::factory()->admin()->create();
    $cat = Category::factory()->create();

    $this->actingAs($admin)
        ->get(route('admin.categories.edit', $cat))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/categories/edit', false)
            ->has('category')
        );
});

it('admin actualiza una categoría y regenera slug', function (): void {
    $admin = User::factory()->admin()->create();
    $cat = Category::factory()->create(['name' => 'Old Name', 'slug' => 'old-name']);

    $this->actingAs($admin)
        ->put(route('admin.categories.update', $cat), ['name' => 'New Name'])
        ->assertRedirect();

    $cat->refresh();
    expect($cat->name)->toBe('New Name');
    expect($cat->slug)->toBe('new-name');
    expect(AuditLog::where('action', 'category.updated')->exists())->toBeTrue();
});

it('rechaza nombre duplicado al actualizar (otro registro)', function (): void {
    $admin = User::factory()->admin()->create();
    Category::factory()->create(['name' => 'Existente']);
    $cat = Category::factory()->create(['name' => 'Original']);

    $this->actingAs($admin)
        ->put(route('admin.categories.update', $cat), ['name' => 'Existente'])
        ->assertSessionHasErrors('name');
});

it('permite guardar con el mismo nombre (ignore self)', function (): void {
    $admin = User::factory()->admin()->create();
    $cat = Category::factory()->create(['name' => 'Acción']);

    $this->actingAs($admin)
        ->put(route('admin.categories.update', $cat), ['name' => 'Acción'])
        ->assertRedirect();
});

// ── Destroy ─────────────────────────────────────────────────────────

it('admin elimina una categoría sin juegos', function (): void {
    $admin = User::factory()->admin()->create();
    $cat = Category::factory()->create();

    $this->actingAs($admin)
        ->delete(route('admin.categories.destroy', $cat))
        ->assertRedirectToRoute('admin.categories.index');

    $this->assertDatabaseMissing('categories', ['id' => $cat->id]);
    expect(AuditLog::where('action', 'category.destroyed')->exists())->toBeTrue();
});

it('bloquea eliminar categoría con juegos asociados', function (): void {
    $admin = User::factory()->admin()->create();
    $cat = Category::factory()->create();
    Game::factory()->hasAttached($cat)->create();

    $this->actingAs($admin)
        ->delete(route('admin.categories.destroy', $cat))
        ->assertStatus(422);

    $this->assertDatabaseHas('categories', ['id' => $cat->id]);
});
