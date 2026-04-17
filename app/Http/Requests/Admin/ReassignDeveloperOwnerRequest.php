<?php

namespace App\Http\Requests\Admin;

use App\Models\Developer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Valida la reasignación de titular de una ficha de developer (Fase 4.2, S4.5).
 *
 * `user_id = null` es explícito — desvincula el titular y convierte la ficha
 * en manual. Cuando se provee un `user_id` nuevo, debe apuntar a un usuario
 * que aún no tenga ninguna otra ficha reclamada (invariante de la columna
 * unique en `developers.user_id`).
 */
class ReassignDeveloperOwnerRequest extends FormRequest
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
        /** @var Developer $developer */
        $developer = $this->route('developer');

        return [
            'user_id' => [
                'present',
                'nullable',
                'integer',
                Rule::exists('users', 'id'),
                Rule::unique('developers', 'user_id')->ignore($developer->id),
            ],
        ];
    }
}
