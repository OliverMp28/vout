<?php

namespace App\Http\Requests\Developers;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación del formulario de creación de aplicación del ecosistema
 * (Developer Portal — Fase 4.1).
 *
 * Soporta dos perfiles:
 *   1. "App con IdP" (requires_auth=true) — se emite un OAuth client.
 *      Requiere al menos un redirect URI y decide confidencialidad.
 *   2. "Juego cliente-puro" (requires_auth=false) — no se crea client.
 *      Solo se necesitan allowed_origins para el handshake postMessage.
 */
class StoreDeveloperAppRequest extends FormRequest
{
    /**
     * Autorización vía policy (RegisteredAppPolicy::create).
     * El controlador aplica authorizeResource, por lo que devolvemos true.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'min:2',
                'max:80',
                Rule::unique('registered_apps', 'name')->where('user_id', $this->user()->id),
            ],
            'app_url' => ['required', 'string', 'url:http,https', 'max:255'],
            'requires_auth' => ['required', 'boolean'],

            'allowed_origins' => ['required', 'array', 'min:1', 'max:10'],
            'allowed_origins.*' => [
                'required',
                'string',
                'distinct',
                'regex:#^https?://[^/\s]+$#',
                'max:255',
            ],

            'confidential' => ['required_if:requires_auth,true', 'boolean'],

            'redirect_uris' => [
                'required_if:requires_auth,true',
                'array',
                'min:1',
                'max:5',
            ],
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
     * Mensajes personalizados (usan las claves de validation.* por defecto
     * cuando aplica; aquí añadimos solo los específicos del dominio).
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'allowed_origins.*.regex' => __('validation.custom.origin'),
        ];
    }

    /**
     * Regla: cada redirect_uri debe pertenecer a uno de los allowed_origins.
     * Prevención crítica de CSRF/open-redirect.
     */
    private function redirectBelongsToAllowedOrigin(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || $value === '') {
                return;
            }

            $origins = $this->input('allowed_origins', []);
            if (! is_array($origins)) {
                return;
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
