<?php

use App\Models\AuditLog;
use App\Models\Developer;
use App\Models\User;

use function Pest\Laravel\actingAs;

it('reasigna el titular de una ficha al admin con audit log', function (): void {
    $admin = User::factory()->admin()->create();
    $oldOwner = User::factory()->create();
    $newOwner = User::factory()->create();
    $developer = Developer::factory()->create(['user_id' => $oldOwner->id]);

    actingAs($admin)
        ->post(
            route('admin.developers.reassign', $developer),
            ['user_id' => $newOwner->id],
        )
        ->assertRedirect(route('admin.developers.edit', $developer));

    expect($developer->fresh()->user_id)->toBe($newOwner->id);

    $audit = AuditLog::query()->latest('id')->first();
    expect($audit)->not->toBeNull()
        ->and($audit->action)->toBe('developer.owner_reassigned')
        ->and($audit->auditable_id)->toBe($developer->id);
});

it('desvincula al titular cuando user_id viene null', function (): void {
    $admin = User::factory()->admin()->create();
    $oldOwner = User::factory()->create();
    $developer = Developer::factory()->create(['user_id' => $oldOwner->id]);

    actingAs($admin)
        ->post(
            route('admin.developers.reassign', $developer),
            ['user_id' => null],
        )
        ->assertRedirect(route('admin.developers.edit', $developer));

    expect($developer->fresh()->user_id)->toBeNull();

    $audit = AuditLog::query()->latest('id')->first();
    expect($audit->action)->toBe('developer.owner_cleared');
});

it('rechaza asignar un user que ya tiene otra ficha reclamada', function (): void {
    $admin = User::factory()->admin()->create();
    $ownerA = User::factory()->create();
    $ownerB = User::factory()->create();
    Developer::factory()->create(['user_id' => $ownerB->id]);
    $target = Developer::factory()->create(['user_id' => $ownerA->id]);

    actingAs($admin)
        ->post(
            route('admin.developers.reassign', $target),
            ['user_id' => $ownerB->id],
        )
        ->assertSessionHasErrors('user_id');

    expect($target->fresh()->user_id)->toBe($ownerA->id);
});

it('rechaza un user_id que no existe', function (): void {
    $admin = User::factory()->admin()->create();
    $developer = Developer::factory()->create();

    actingAs($admin)
        ->post(
            route('admin.developers.reassign', $developer),
            ['user_id' => 9999999],
        )
        ->assertSessionHasErrors('user_id');
});

it('bloquea a usuarios no admin', function (): void {
    $user = User::factory()->create();
    $developer = Developer::factory()->create();

    actingAs($user)
        ->post(
            route('admin.developers.reassign', $developer),
            ['user_id' => null],
        )
        ->assertForbidden();
});

it('lista distinguiendo fichas reclamadas y manuales', function (): void {
    $admin = User::factory()->admin()->create();
    Developer::factory()->create(['user_id' => User::factory()->create()->id]);
    Developer::factory()->create(['user_id' => null]);

    $response = actingAs($admin)->get(route('admin.developers.index', ['claimed' => 'claimed']));

    $response->assertOk();
    $response->assertInertia(
        fn ($page) => $page
            ->component('admin/developers/index')
            ->where('developers.data.0.owner', fn ($owner) => $owner !== null),
    );
});
