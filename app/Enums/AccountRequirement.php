<?php

namespace App\Enums;

/**
 * Si hace falta una cuenta de Vout para jugar a un juego y si el juego
 * recibe la identidad del jugador.
 *
 * Lo declara el desarrollador y lo revisa el admin. Decide qué hace
 * `/play/{game}` con cada visitante:
 *
 *   - Un invitado (o una cuenta sin el email confirmado) juega en los modos
 *     `none` y `optional`, y el juego recibe `VOUT_GUEST` en lugar de
 *     `VOUT_AUTH`. En `required` se le manda a entrar.
 *   - Una cuenta confirmada recibe su identidad (`VOUT_AUTH`) en `optional`
 *     y `required`. En `none` el juego nunca la recibe: no la usa, así que
 *     no se le da (minimización de datos) y una app de terceros no pide
 *     consentimiento.
 */
enum AccountRequirement: string
{
    /** El juego no usa la cuenta de Vout: nadie la necesita ni la comparte. */
    case None = 'none';

    /** Se juega sin cuenta; con ella, el juego reconoce al jugador. */
    case Optional = 'optional';

    /** Hay que entrar con una cuenta confirmada para jugar. */
    case Required = 'required';

    /**
     * Si se puede jugar sin cuenta.
     */
    public function allowsGuests(): bool
    {
        return $this !== self::Required;
    }

    /**
     * Si el juego recibe la identidad de quien juega con cuenta.
     */
    public function sharesIdentity(): bool
    {
        return $this !== self::None;
    }
}
