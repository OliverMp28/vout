<?php

namespace App\Http\Requests\Developers;

use App\Models\Developer;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación del formulario de alta/edición de la ficha pública del dev
 * (Developer Portal — Fase 4.2, S4.5).
 *
 * Un usuario sólo puede tener una ficha (`developers.user_id` es `unique`),
 * así que el mismo request sirve para claim inicial y para actualizaciones
 * posteriores. El slug se regenera servidor-side y no se acepta del cliente.
 */
class UpsertDeveloperProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        $ownedId = Developer::query()
            ->where('user_id', $this->user()->id)
            ->value('id');

        return [
            'name' => [
                'required',
                'string',
                'min:2',
                'max:150',
                Rule::unique('developers', 'name')->ignore($ownedId),
            ],
            'website_url' => ['nullable', 'string', 'url:http,https', 'max:500'],
            'bio' => ['nullable', 'string', 'max:500'],
            'logo_url' => ['nullable', 'string', 'url:http,https', 'max:500'],
        ];
    }
}
