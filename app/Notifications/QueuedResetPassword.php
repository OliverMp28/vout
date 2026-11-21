<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Correo de recuperación de contraseña de Laravel, enviado por la cola.
 *
 * Mismo motivo que `QueuedVerifyEmail`: un fallo del proveedor SMTP no debe
 * convertirse en un error 500 en la pantalla de "olvidé mi contraseña".
 */
class QueuedResetPassword extends ResetPassword implements ShouldQueue
{
    use Queueable;
}
