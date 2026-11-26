<?php

namespace App\Support;

use Illuminate\Validation\Rules\Password;

/**
 * Política de contraseñas de Vout: la misma en el registro, al restablecer
 * la contraseña y al cambiarla en ajustes (todas usan `Password::default()`).
 *
 * Solo se exige en producción; en local y en los tests cualquier contraseña
 * vale. Los formularios muestran la pista solo cuando se exige, a partir de
 * `requirements()`, para que diga lo mismo que el servidor.
 */
final class PasswordPolicy
{
    public const int MIN_LENGTH = 8;

    /**
     * Segundos que se espera a la API de contraseñas filtradas. Si no
     * contesta a tiempo, la comprobación se salta: el registro no se queda
     * colgado (con la espera por defecto de 30 s, el formulario seguía
     * mostrando el error del intento anterior mientras tanto).
     */
    public const int BREACH_CHECK_TIMEOUT_SECONDS = 3;

    public static function enforced(): bool
    {
        return app()->isProduction();
    }

    public static function rule(): ?Password
    {
        if (! self::enforced()) {
            return null;
        }

        return Password::min(self::MIN_LENGTH)
            ->letters()
            ->numbers()
            ->uncompromised();
    }

    /**
     * Lo que se exige, para la pista de los formularios; null si no se exige nada.
     *
     * @return array{min: int}|null
     */
    public static function requirements(): ?array
    {
        return self::enforced() ? ['min' => self::MIN_LENGTH] : null;
    }
}
