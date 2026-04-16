<?php

namespace App\Http\Requests\Developers;

use App\Models\Category;
use App\Models\Developer;
use App\Models\RegisteredApp;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación del formulario de envío de juego al catálogo (Fase 4.2, S1).
 *
 * Reglas de dominio aplicadas:
 *   - La `RegisteredApp` vinculada debe pertenecer al usuario autenticado y
 *     estar activa (no suspendida ni pausada). Evita que un dev reciclado use
 *     apps de otros o apps deshabilitadas como "canal" al catálogo.
 *   - El `embed_url` debe quedar dentro de los `allowed_origins` declarados
 *     en esa app. Esta restricción refleja la policy de orígenes que luego
 *     aplica `Game::getEffectiveOriginsAttribute()` en el handshake 3.3.
 *   - `name` es único por dev para evitar colisiones accidentales en su
 *     propio dashboard (otros devs pueden repetir nombres).
 */
class StoreDeveloperGameRequest extends FormRequest
{
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
                'max:120',
                Rule::unique('games', 'name')->where('submitted_by_user_id', $this->user()->id),
            ],
            'description' => ['required', 'string', 'min:20', 'max:2000'],

            'registered_app_id' => [
                'required',
                'integer',
                $this->ownedActiveApp(),
            ],

            'embed_url' => [
                'required',
                'string',
                'url:https',
                'max:500',
                $this->embedInsideAllowedOrigins(),
            ],

            'cover_image' => ['nullable', 'string', 'url:https', 'max:500'],
            'release_date' => ['nullable', 'date', 'before_or_equal:today'],
            'repo_url' => ['nullable', 'string', 'url:https', 'max:500'],

            'category_ids' => ['required', 'array', 'min:1', 'max:5'],
            'category_ids.*' => [
                'integer',
                'distinct',
                Rule::exists(Category::class, 'id'),
            ],

            'developer_ids' => ['nullable', 'array', 'max:10'],
            'developer_ids.*' => [
                'integer',
                'distinct',
                Rule::exists(Developer::class, 'id'),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'embed_url.url' => __('validation.custom.embed_url_https'),
            'cover_image.url' => __('validation.custom.cover_image_https'),
        ];
    }

    /**
     * Regla: la app debe pertenecer al user actual y estar activa.
     */
    private function ownedActiveApp(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_numeric($value)) {
                return;
            }

            $app = RegisteredApp::query()
                ->where('id', (int) $value)
                ->where('user_id', $this->user()->id)
                ->first();

            if ($app === null) {
                $fail(__('validation.custom.registered_app_not_owned'));

                return;
            }

            if (! $app->is_active) {
                $fail(__('validation.custom.registered_app_inactive'));
            }
        };
    }

    /**
     * Regla: el `embed_url` debe caer dentro de uno de los `allowed_origins`
     * declarados en la `RegisteredApp` seleccionada.
     */
    private function embedInsideAllowedOrigins(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || $value === '') {
                return;
            }

            $appId = $this->input('registered_app_id');
            if (! is_numeric($appId)) {
                return;
            }

            $app = RegisteredApp::query()
                ->where('id', (int) $appId)
                ->where('user_id', $this->user()->id)
                ->first();

            if ($app === null) {
                return; // ownedActiveApp() ya habrá marcado error.
            }

            $origins = $app->allowed_origins ?? [];

            $match = collect($origins)
                ->filter(fn ($origin): bool => is_string($origin) && $origin !== '')
                ->contains(fn (string $origin): bool => str_starts_with($value, rtrim($origin, '/').'/')
                    || $value === rtrim($origin, '/'));

            if (! $match) {
                $fail(__('validation.custom.embed_url_not_in_allowed_origins'));
            }
        };
    }
}
