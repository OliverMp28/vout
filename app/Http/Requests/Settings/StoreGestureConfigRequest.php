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
            'head_tracking_mode' => ['sometimes', 'string', 'in:cursor,gesture,disabled'],
            // gesture_mapping: cada entrada es un GameAction (objeto con 'type' discriminado).
            'gesture_mapping' => ['required', 'array'],
            'gesture_mapping.*' => ['array'],
            'gesture_mapping.*.type' => ['required', 'string', 'in:keyboard,mouse_click,game_event,none'],
            'gesture_mapping.*.key' => ['required_if:gesture_mapping.*.type,keyboard', 'string'],
            'gesture_mapping.*.mode' => ['required_if:gesture_mapping.*.type,keyboard', 'string', 'in:press,hold'],
            'gesture_mapping.*.button' => ['required_if:gesture_mapping.*.type,mouse_click', 'string', 'in:left,right'],
            'gesture_mapping.*.event' => ['required_if:gesture_mapping.*.type,game_event', 'string'],
            'is_active' => ['boolean'],
        ];
    }
}
