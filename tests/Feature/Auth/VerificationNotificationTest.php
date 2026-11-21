<?php

use App\Models\User;
use App\Models\UserSetting;
use App\Notifications\QueuedVerifyEmail;
use Illuminate\Support\Facades\Notification;

test('sends verification notification', function () {
    Notification::fake();

    $user = User::factory()->unverified()->create();

    $this->actingAs($user)
        ->post(route('verification.send'))
        ->assertRedirect(route('home'));

    Notification::assertSentTo($user, QueuedVerifyEmail::class);
});

test('does not send verification notification if email is verified', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('verification.send'))
        ->assertRedirect(route('dashboard', absolute: false));

    Notification::assertNothingSent();
});

test('the verification email goes out in the language chosen by the user', function (string $locale) {
    Notification::fake();

    $user = User::factory()->unverified()->create();
    UserSetting::factory()->for($user)->create(['locale' => $locale]);

    $this->actingAs($user)->post(route('verification.send'));

    Notification::assertSentTo(
        $user,
        QueuedVerifyEmail::class,
        fn ($notification, array $channels, object $notifiable, ?string $sentLocale): bool => $sentLocale === $locale,
    );
})->with(['es', 'en']);

test('the verification email is translated to spanish', function () {
    app()->setLocale('es');

    $mail = (new QueuedVerifyEmail)->toMail(User::factory()->unverified()->create());

    expect($mail->subject)->toBe('Confirma tu correo electrónico')
        ->and($mail->actionText)->toBe('Confirmar correo');
});
