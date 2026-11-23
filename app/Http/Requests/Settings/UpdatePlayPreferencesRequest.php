<?php

namespace App\Http\Requests\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Preferencias que se cambian desde la página de juego: si el panel de
 * control facial está abierto (null vuelve a "lo que diga el perfil de
 * uso") y si se ve la cámara mientras se juega.
 */
class UpdatePlayPreferencesRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'play_panel_open' => ['sometimes', 'nullable', 'boolean'],
            'show_camera_preview' => ['sometimes', 'required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'play_panel_open.boolean' => __('validation.custom.play_preference_boolean'),
            'show_camera_preview.boolean' => __('validation.custom.play_preference_boolean'),
        ];
    }
}
