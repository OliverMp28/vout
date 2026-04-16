<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación para editar un developer desde el panel admin (Fase 4.2, S4).
 */
class UpdateDeveloperRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Middleware `admin` ya protege la ruta.
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'min:2', 'max:150',
                Rule::unique('developers', 'name')->ignore($this->route('developer')),
            ],
            'website_url' => ['nullable', 'url', 'max:500'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'logo_url' => ['nullable', 'url', 'max:500'],
        ];
    }
}
