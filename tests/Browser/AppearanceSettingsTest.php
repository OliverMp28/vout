<?php

use App\Enums\FacialControlUsage;
use App\Models\GestureConfig;
use App\Models\User;
use App\Models\UserSetting;

// -----------------------------------------------------------------------
// Ajustes → Apariencia en el navegador: el perfil de uso del control
// facial se guarda al elegirlo y los botones del asistente ya no envían
// ningún formulario.
// -----------------------------------------------------------------------

/**
 * Espera a que el perfil de uso guardado sea `$usage` (se guarda al
 * cambiarlo, sin botón).
 */
function waitForSavedUsage(User $user, FacialControlUsage $usage, int $timeoutMs = 10000): bool
{
    $deadline = microtime(true) + $timeoutMs / 1000;

    while (microtime(true) < $deadline) {
        if ($user->settings()->first()?->facial_control_usage === $usage) {
            return true;
        }

        usleep(100_000);
    }

    return false;
}

test('elegir "juego con la cámara" se guarda solo y ofrece el encendido automático', function (): void {
    $user = User::factory()->create();
    UserSetting::factory()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    $this->actingAs($user);

    $page = visit('/settings/appearance');

    $page->assertMissing('#camera_autostart')
        ->click('#facial-control-usage-primary');

    expect(waitForSavedUsage($user, FacialControlUsage::Primary))->toBeTrue();

    $page->assertVisible('#camera_autostart')
        // Con la cámara en uso aparece el asistente.
        ->assertSee('Activar cámara')
        ->click('#camera_autostart');

    $deadline = microtime(true) + 10;
    while (microtime(true) < $deadline && ! $user->settings()->first()->camera_autostart) {
        usleep(100_000);
    }

    expect($user->settings()->first()->camera_autostart)->toBeTrue();

    // Volver a "no uso la cámara" lo apaga todo.
    $page->click('#facial-control-usage-off');

    expect(waitForSavedUsage($user, FacialControlUsage::Off))->toBeTrue()
        ->and($user->settings()->first()->camera_autostart)->toBeFalse();

    $page->assertMissing('#camera_autostart')
        ->assertDontSee('Activar cámara')
        ->assertNoJavaScriptErrors();
});

test('el asistente y el editor de mapeo no están dentro de ningún formulario', function (): void {
    // Antes iban dentro del formulario de Apariencia y sus botones (sin
    // `type="button"`) lo enviaban.
    $user = User::factory()->create();
    UserSetting::factory()->occasionalCamera()->for($user)->create(['show_mascot' => false, 'locale' => 'es']);
    GestureConfig::factory()->for($user)->active()->create();
    $this->actingAs($user);

    $page = visit('/settings/appearance');

    $page->assertSee('Guardar mapeo');

    $submitting = $page->script(<<<'JS'
        Array.from(document.querySelectorAll('button'))
            .filter((button) => button.closest('form') !== null && button.type === 'submit')
            .map((button) => button.textContent.trim())
    JS);

    expect($submitting)->toBe([]);

    $page->assertNoJavaScriptErrors();
});
