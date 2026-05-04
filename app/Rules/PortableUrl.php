<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;

/**
 * URL completa con scheme http o https.
 *
 * - `https://...` siempre válido.
 * - `http://...` solo en entorno `local` (o cuando `vout.allow_insecure_urls`
 *   está forzado a `true` en config). Mantiene producción estricta.
 *
 * No depende del validador `url:` de Laravel/Symfony porque éste rechaza
 * algunos hosts sin TLD (caso `http://localhost:3000`) según la versión.
 */
class PortableUrl implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            $fail(__('validation.url', ['attribute' => $attribute]));

            return;
        }

        $parsed = parse_url($value);
        if ($parsed === false || ! isset($parsed['scheme'], $parsed['host'])) {
            $fail(__('validation.url', ['attribute' => $attribute]));

            return;
        }

        $scheme = strtolower((string) $parsed['scheme']);
        if (! in_array($scheme, ['http', 'https'], true)) {
            $fail(__('validation.url', ['attribute' => $attribute]));

            return;
        }

        if ($scheme === 'http' && ! self::insecureAllowed()) {
            $fail(__('validation.custom.url_https_required'));
        }
    }

    /**
     * Indica si el entorno actual permite registrar URLs http.
     *
     * Prioriza el flag explícito `vout.allow_insecure_urls`; si está nulo,
     * cae al check de entorno `local` para evitar imponer una variable
     * extra en desarrollo cotidiano.
     */
    public static function insecureAllowed(): bool
    {
        $config = Config::get('vout.allow_insecure_urls');
        if ($config !== null) {
            return (bool) $config;
        }

        return App::environment('local');
    }
}
