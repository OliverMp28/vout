<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class ToggleFavoriteRequest extends FormRequest
{
    /**
     * Solo usuarios autenticados pueden marcar favoritos.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, array<string>> */
    public function rules(): array
    {
        return [];
    }
}
