<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class GameIndexRequest extends FormRequest
{
    /**
     * El catálogo es público — guests y usuarios autenticados pueden filtrar.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<string>>
     */
    public function rules(): array
    {
        return [
            'categories' => ['nullable', 'array', 'max:6'],
            'categories.*' => ['string', 'exists:categories,slug'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'string', 'in:popular,newest,alphabetical'],
            'cursor' => ['nullable', 'string'],
        ];
    }

    /**
     * Devuelve los filtros validados con valores por defecto aplicados.
     *
     * Centraliza los defaults aquí para que el controller permanezca limpio.
     *
     * @return array{categories: list<string>, search: string, sort: string}
     */
    public function filters(): array
    {
        return [
            'categories' => $this->array('categories', []),
            'search' => $this->string('search')->trim()->toString(),
            'sort' => $this->string('sort', 'popular')->toString(),
        ];
    }
}
