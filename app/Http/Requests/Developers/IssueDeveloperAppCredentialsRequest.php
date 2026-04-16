<?php

namespace App\Http\Requests\Developers;

use App\Models\RegisteredApp;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación del formulario de re-emisión de credenciales OAuth
 * para una app cuyo client fue revocado (tras suspensión admin).
 *
 * Solo aplica a apps con `requires_auth = true` y `oauth_client_id = null`.
 * Los `redirect_uris` se validan contra los `allowed_origins` persistidos
 * en la app (no se editan aquí — ese flujo vive en la pestaña Orígenes).
 */
class IssueDeveloperAppCredentialsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'confidential' => ['required', 'boolean'],

            'redirect_uris' => ['required', 'array', 'min:1', 'max:5'],
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
     * Cada redirect_uri debe pertenecer a uno de los allowed_origins
     * actuales de la app (estado persistido, no input).
     */
    private function redirectBelongsToAllowedOrigin(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || $value === '') {
                return;
            }

            /** @var RegisteredApp|null $app */
            $app = $this->route('app');
            $origins = $app?->allowed_origins ?? [];

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
