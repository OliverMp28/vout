<?php

use App\Models\User;

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register with consent', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'username' => 'testuser',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'accept_terms' => true,
        'confirm_age' => true,
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));

    $user = User::where('email', 'test@example.com')->firstOrFail();
    expect($user->terms_accepted_at)->not->toBeNull();
    expect($user->privacy_version_accepted)->toBe(config('vout.legal.current_privacy_version'));
});

test('registration is rejected without terms acceptance', function () {
    $response = $this->from(route('register'))->post(route('register.store'), [
        'name' => 'No Terms',
        'username' => 'noterms',
        'email' => 'noterms@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'accept_terms' => false,
        'confirm_age' => true,
    ]);

    $response->assertRedirect(route('register'));
    $response->assertSessionHasErrors('accept_terms');
    $this->assertGuest();
    expect(User::where('email', 'noterms@example.com')->exists())->toBeFalse();
});

test('registration is rejected without age confirmation', function () {
    $response = $this->from(route('register'))->post(route('register.store'), [
        'name' => 'No Age',
        'username' => 'noage',
        'email' => 'noage@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'accept_terms' => true,
        'confirm_age' => false,
    ]);

    $response->assertRedirect(route('register'));
    $response->assertSessionHasErrors('confirm_age');
    $this->assertGuest();
    expect(User::where('email', 'noage@example.com')->exists())->toBeFalse();
});

test('registration is rejected when both consents missing', function () {
    $response = $this->from(route('register'))->post(route('register.store'), [
        'name' => 'No Consents',
        'username' => 'noconsents',
        'email' => 'noconsents@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertRedirect(route('register'));
    $response->assertSessionHasErrors(['accept_terms', 'confirm_age']);
    $this->assertGuest();
});
