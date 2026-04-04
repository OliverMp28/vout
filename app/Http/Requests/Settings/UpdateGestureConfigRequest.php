<?php

namespace App\Http\Requests\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateGestureConfigRequest extends FormRequest
{
    /**
     * Reglas de validación para actualizar un perfil de gestos.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'profile_name' => ['sometimes', 'string', 'max:100'],
            'detection_mode' => ['sometimes', 'string', 'in:face_landmarks'],
            'sensitivity' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'gesture_mapping' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
