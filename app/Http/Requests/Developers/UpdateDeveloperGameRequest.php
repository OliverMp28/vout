<?php

namespace App\Http\Requests\Developers;

use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Models\RegisteredApp;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación del formulario de edición de un juego enviado al catálogo.
 *
 * Variante `sometimes` de StoreDeveloperGameRequest: permite actualizaciones
 * parciales desde el dashboard cuando un juego está en estado editable
 * (`draft`, `pending_review`, `rejected`). El `slug` es inmutable tras la
 * creación para no romper URLs públicas del catálogo.
 */
class UpdateDeveloperGameRequest extends FormRequest
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
        /** @var Game $game */
        $game = $this->route('game');

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'min:2',
                'max:120',
                Rule::unique('games', 'name')
                    ->where('submitted_by_user_id', $this->user()->id)
                    ->ignore($game->id),
            ],
            'description' => ['sometimes', 'required', 'string', 'min:20', 'max:2000'],

            'registered_app_id' => [
                'sometimes',
                'required',
                'integer',
                $this->ownedActiveApp(),
            ],

            'embed_url' => [
                'sometimes',
                'required',
                'string',
                'url:https',
                'max:500',
                $this->embedInsideAllowedOrigins(),
            ],

            'cover_image' => ['sometimes', 'nullable', 'string', 'url:https', 'max:500'],
            'release_date' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'repo_url' => ['sometimes', 'nullable', 'string', 'url:https', 'max:500'],

            'category_ids' => ['sometimes', 'required', 'array', 'min:1', 'max:5'],
            'category_ids.*' => [
                'integer',
                'distinct',
                Rule::exists(Category::class, 'id'),
            ],

            'developer_ids' => ['sometimes', 'nullable', 'array', 'max:10'],
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
     * El `embed_url` debe caer bajo un `allowed_origin` de la app actualmente
     * vinculada. Si la petición trae `registered_app_id` nuevo, se usa ese;
     * si no, se usa el de la app ya asociada al juego.
     */
    private function embedInsideAllowedOrigins(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || $value === '') {
                return;
            }

            $appId = $this->input('registered_app_id');
            if (! is_numeric($appId)) {
                /** @var Game $game */
                $game = $this->route('game');
                $appId = $game->registered_app_id;
            }

            if ($appId === null) {
                return;
            }

            $app = RegisteredApp::query()
                ->where('id', (int) $appId)
                ->where('user_id', $this->user()->id)
                ->first();

            if ($app === null) {
                return;
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
