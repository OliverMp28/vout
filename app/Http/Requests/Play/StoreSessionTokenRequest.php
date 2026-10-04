<?php

namespace App\Http\Requests\Play;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación de la renovación del token de una sesión de juego embebido.
 *
 * El portal envía el `vout_id` del usuario para el que se renderizó la
 * página de juego. `SessionTokenController` lo compara con el usuario de
 * la sesión web para no emitir un token a nombre de otra cuenta si esta
 * cambió en otra pestaña.
 */
class StoreSessionTokenRequest extends FormRequest
{
    /**
     * Solo usuarios autenticados pueden renovar su sesión de juego.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'vout_id' => ['required', 'uuid'],
        ];
    }
}
