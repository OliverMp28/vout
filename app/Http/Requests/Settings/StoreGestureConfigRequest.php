<?php

namespace App\Http\Requests\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreGestureConfigRequest extends FormRequest
{
    /**
     * Reglas de validación para crear un perfil de gestos.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'profile_name' => ['required', 'string', 'max:100'],
            'detection_mode' => ['required', 'string', 'in:face_landmarks'],
            'sensitivity' => ['required', 'integer', 'min:1', 'max:10'],
            'gesture_mapping' => ['required', 'array'],
            'is_active' => ['boolean'],
        ];
    }
}
