<?php

namespace App\Http\Requests\Settings;

use App\Enums\FacialControlUsage;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Preferencias del usuario en Ajustes → Apariencia.
 *
 * Cada campo es opcional porque cada control se guarda por separado al
 * cambiarlo: los tabs de tema envían solo `appearance`, el interruptor de la
 * mascota `show_mascot`, el perfil de uso `facial_control_usage` y la
 * casilla del encendido automático `camera_autostart`.
 */
class UpdateUserSettingRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'appearance' => ['sometimes', 'required', Rule::in(['light', 'dark', 'system'])],
            'show_mascot' => ['sometimes', 'required', 'boolean'],
            'facial_control_usage' => ['sometimes', 'required', Rule::enum(FacialControlUsage::class)],
            'camera_autostart' => ['sometimes', 'required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'facial_control_usage.enum' => __('validation.custom.facial_control_usage_invalid'),
        ];
    }
}
