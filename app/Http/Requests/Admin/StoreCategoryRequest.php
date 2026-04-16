<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación para crear una categoría desde el panel admin (Fase 4.2, S4).
 */
class StoreCategoryRequest extends FormRequest
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
            'name' => ['required', 'string', 'min:2', 'max:100', 'unique:categories,name'],
        ];
    }
}
