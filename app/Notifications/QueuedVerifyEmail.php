<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Correo de confirmación de email de Laravel, enviado por la cola.
 *
 * Sale de la petición de registro: si el proveedor SMTP tarda o rechaza el
 * envío (p. ej. por el cupo diario), el registro no falla y el job queda
 * para reintentar. El enlace firmado se genera en el worker con `APP_URL`.
 */
class QueuedVerifyEmail extends VerifyEmail implements ShouldQueue
{
    use Queueable;
}
