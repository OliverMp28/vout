<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación para rechazar un juego desde el panel admin (Fase 4.2, S3).
 *
 * Requiere un motivo descriptivo (10–500 chars) que se persiste en
 * `rejection_reason` y se comunica al dev vía notificación.
 */
class RejectGameRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Middleware `admin` ya protege la ruta.
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ];
    }
}
