<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Origin (`scheme://host[:puerto]`) sin path/query/fragment.
 *
 * Mismas reglas de scheme que `PortableUrl`:
 *   - `https://` siempre válido.
 *   - `http://` solo en entorno `local` o cuando `vout.allow_insecure_urls`
 *     está forzado a `true`.
 *
 * Refleja la semántica de `Origin` de la Web (RFC 6454): exactamente
 * scheme + host + puerto opcional, nada más. Lo que `RegisteredApp`
 * persiste en `allowed_origins` y compara después contra `event.origin`
 * en el handshake postMessage.
 */
class PortableOrigin implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            $fail(__('validation.custom.origin'));

            return;
        }

        if (! preg_match('~^https?://[^\s/?#]+$~', $value)) {
            $fail(__('validation.custom.origin'));

            return;
        }

        $parsed = parse_url($value);
        if ($parsed === false || ! isset($parsed['scheme'], $parsed['host'])) {
            $fail(__('validation.custom.origin'));

            return;
        }

        $scheme = strtolower((string) $parsed['scheme']);
        if ($scheme === 'http' && ! PortableUrl::insecureAllowed()) {
            $fail(__('validation.custom.origin_https_required'));
        }
    }
}
