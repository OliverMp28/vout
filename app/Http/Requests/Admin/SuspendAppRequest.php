<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación para suspender una app del ecosistema (Fase 4.2, S2).
 *
 * Requiere un motivo mínimamente descriptivo (10–500 chars) que se persiste
 * en `suspension_reason` y se envía al owner vía notificación.
 */
class SuspendAppRequest extends FormRequest
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
            'remark' => ['required', 'string', 'min:10', 'max:500'],
        ];
    }
}
