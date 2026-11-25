<?php

namespace App\Http\Requests\Admin;

use App\Enums\AccountRequirement;
use App\Enums\FacialControlSupport;
use App\Rules\PortableUrl;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Edición administrativa de un juego (corregir typos, metadatos, categorías
 * y si admite el control facial). El admin puede editar cualquier juego en
 * cualquier estado; todo es opcional para permitir cambios parciales.
 */
class UpdateGameRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Middleware `admin` ya protege la ruta.
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'description' => ['sometimes', 'string', 'min:20', 'max:5000'],
            'embed_url' => ['sometimes', new PortableUrl],
            'facial_control_support' => ['sometimes', 'required', Rule::enum(FacialControlSupport::class)],
            'account_requirement' => ['sometimes', 'required', Rule::enum(AccountRequirement::class)],
            'cover_image' => ['nullable', new PortableUrl, 'max:500'],
            'release_date' => ['nullable', 'date'],
            'repo_url' => ['nullable', new PortableUrl, 'max:500'],
            'category_ids' => ['sometimes', 'array', 'min:1', 'max:5'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'developer_ids' => ['sometimes', 'array', 'max:10'],
            'developer_ids.*' => ['integer', 'exists:developers,id'],
        ];
    }
}
