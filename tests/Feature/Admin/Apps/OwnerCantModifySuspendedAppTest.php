<?php

use App\Models\RegisteredApp;
use App\Models\User;

it('el owner no puede alternar is_active si la app está suspendida', function (): void {
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->suspended()->create();

    $this->actingAs($owner)
        ->post(route('developers.apps.toggle', $app))
        ->assertForbidden();

    expect($app->fresh()->is_active)->toBeFalse();
});

it('el owner no puede regenerar secreto si la app está suspendida', function (): void {
    $owner = User::factory()->create();
    $app = RegisteredApp::factory()->forUser($owner)->suspended()->withClient()->create();

    $this->actingAs($owner)
        ->post(route('developers.apps.secret', $app))
        ->assertForbidden();
});
