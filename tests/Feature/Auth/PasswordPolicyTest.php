<?php

use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Password;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\NotPwnedVerifier;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Política de contraseñas en producción (`PasswordPolicy`): al menos 8
 * caracteres, letras, números y que no esté filtrada. La misma en registro,
 * restablecer y ajustes. En los tests la app no es `production`, así que
 * cada test cambia el entorno; el CSRF solo se salta en `testing`, por eso
 * se quita a mano.
 */

const LEAKED_PASSWORD = 'gatito2024';

beforeEach(function (): void {
    app()->detectEnvironment(fn (): string => 'production');
    $this->withoutMiddleware(PreventRequestForgery::class);

    $hash = strtoupper(sha1(LEAKED_PASSWORD));

    Http::preventStrayRequests();
    Http::fake([
        'api.pwnedpasswords.com/range/'.substr($hash, 0, 5) => Http::response(substr($hash, 5).":3861\r\n"),
        'api.pwnedpasswords.com/*' => Http::response(''),
    ]);
});

function registerWithPassword(string $password, string $locale = 'es'): TestResponse
{
    return test()->withSession(['locale' => $locale])
        ->from(route('register'))
        ->post(route('register.store'), [
            'name' => 'Oliver',
            'username' => 'oliver',
            'email' => 'oliver@example.com',
            'password' => $password,
            'password_confirmation' => $password,
            'accept_terms' => true,
            'confirm_age' => true,
        ]);
}

it('acepta una contraseña de 8 caracteres con letras y números', function (): void {
    registerWithPassword('vout2026')->assertRedirect(route('dashboard', absolute: false));

    expect(User::where('email', 'oliver@example.com')->exists())->toBeTrue();
});

it('acepta la contraseña del informe: 13 caracteres con una mayúscula y sin símbolos', function (): void {
    registerWithPassword('Oliverprueba1')->assertRedirect(route('dashboard', absolute: false));
});

it('rechaza cada regla incumplida con su mensaje', function (string $locale, string $password, string $message): void {
    registerWithPassword($password, $locale)
        ->assertRedirect(route('register'))
        ->assertSessionHasErrors(['password' => $message]);

    expect(User::where('email', 'oliver@example.com')->exists())->toBeFalse();
})->with([
    'sin números (es)' => ['es', 'abcdefghij', 'El campo contraseña debe contener al menos un número.'],
    'sin letras (es)' => ['es', '12345678', 'El campo contraseña debe contener al menos una letra.'],
    'menos de 8 (es)' => ['es', 'abc1234', 'El campo contraseña debe tener al menos 8 caracteres.'],
    'filtrada (es)' => ['es', LEAKED_PASSWORD, 'Esta contraseña ha aparecido en una filtración de datos. Elige otra.'],
    'sin números (en)' => ['en', 'abcdefghij', 'The password field must contain at least one number.'],
    'sin letras (en)' => ['en', '12345678', 'The password field must contain at least one letter.'],
    'menos de 8 (en)' => ['en', 'abc1234', 'The password field must be at least 8 characters.'],
    'filtrada (en)' => ['en', LEAKED_PASSWORD, 'The given password has appeared in a data leak. Please choose a different password.'],
]);

it('aplica la misma política al cambiar la contraseña en ajustes', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['locale' => 'es'])
        ->from(route('user-password.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'abcdefghij',
            'password_confirmation' => 'abcdefghij',
        ])
        ->assertSessionHasErrors(['password' => 'El campo contraseña debe contener al menos un número.']);
});

it('aplica la misma política al restablecer la contraseña', function (): void {
    $user = User::factory()->create();

    $this->withSession(['locale' => 'es'])
        ->post(route('password.update'), [
            'token' => Password::createToken($user),
            'email' => $user->email,
            'password' => '12345678',
            'password_confirmation' => '12345678',
        ])
        ->assertSessionHasErrors(['password' => 'El campo contraseña debe contener al menos una letra.']);
});

it('da a los formularios la pista con lo que exige el servidor', function (): void {
    $this->get(route('register'))
        ->assertInertia(fn (Assert $page) => $page->where('passwordRequirements', ['min' => PasswordPolicy::MIN_LENGTH]));
});

it('no muestra pista fuera de producción, donde no se exige nada', function (): void {
    app()->detectEnvironment(fn (): string => 'testing');

    $this->get(route('register'))
        ->assertInertia(fn (Assert $page) => $page->where('passwordRequirements', null));
});

it('no deja el registro esperando a la API de filtraciones', function (): void {
    $verifier = app(UncompromisedVerifier::class);

    expect($verifier)->toBeInstanceOf(NotPwnedVerifier::class)
        ->and((fn (): int => $this->timeout)->call($verifier))->toBe(PasswordPolicy::BREACH_CHECK_TIMEOUT_SECONDS);
});

it('registra igual si la API de filtraciones no contesta', function (): void {
    Http::fake(['api.pwnedpasswords.com/*' => fn () => throw new ConnectionException('timeout')]);

    registerWithPassword('vout2026')->assertRedirect(route('dashboard', absolute: false));
});
