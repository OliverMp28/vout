<?php

namespace App\Http\Requests\Play;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Qué respondió el usuario a los controles que le sugiere un juego:
 * `own` (se queda con los suyos) o la clave del preset que aceptó.
 *
 * La lista de presets vive en el cliente (`action-presets.ts`), que solo
 * ofrece claves que conoce; aquí basta con que tenga forma de clave.
 */
class UpdatePresetChoiceRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'choice' => ['required', 'string', 'max:32', 'regex:/^[a-z][a-z0-9_-]*$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'choice.regex' => __('validation.custom.preset_choice_invalid'),
        ];
    }
}
