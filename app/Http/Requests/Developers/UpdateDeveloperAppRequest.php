<?php

namespace App\Http\Requests\Developers;

use App\Models\RegisteredApp;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación del formulario de edición de aplicación.
 *
 * `name` y `slug` son inmutables tras la creación: cambiarlos
 * rompería integraciones vivas (CORS, redirect_uris, documentación
 * compartida con usuarios). Si un dev quiere otro nombre, crea una
 * nueva app.
 */
class UpdateDeveloperAppRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Reglas de validación (subset editable).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'app_url' => ['sometimes', 'required', 'string', 'url:http,https', 'max:255'],

            'allowed_origins' => ['sometimes', 'required', 'array', 'min:1', 'max:10'],
            'allowed_origins.*' => [
                'required',
                'string',
                'distinct',
                'regex:#^https?://[^/\s]+$#',
                'max:255',
            ],

            'redirect_uris' => ['sometimes', 'array', 'min:1', 'max:5'],
            'redirect_uris.*' => [
                'required',
                'string',
                'url:http,https',
                'distinct',
                'max:255',
                $this->redirectBelongsToAllowedOrigin(),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'allowed_origins.*.regex' => __('validation.custom.origin'),
        ];
    }

    /**
     * Cada redirect_uri debe pertenecer a uno de los allowed_origins.
     * Durante updates, los orígenes de referencia son los del request si
     * vienen ahí; si no, los actuales de la app.
     */
    private function redirectBelongsToAllowedOrigin(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || $value === '') {
                return;
            }

            $origins = $this->input('allowed_origins');
            if (! is_array($origins)) {
                /** @var RegisteredApp|null $app */
                $app = $this->route('app');
                $origins = $app?->allowed_origins ?? [];
            }

            $match = collect($origins)
                ->filter(fn ($origin): bool => is_string($origin) && $origin !== '')
                ->contains(fn (string $origin): bool => str_starts_with($value, rtrim($origin, '/').'/')
                    || $value === rtrim($origin, '/'));

            if (! $match) {
                $fail(__('validation.custom.redirect_uri_not_in_origins'));
            }
        };
    }
}
