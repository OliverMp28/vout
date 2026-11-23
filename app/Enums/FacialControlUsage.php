<?php

namespace App\Enums;

/**
 * Cómo usa el usuario el control facial (Ajustes → Apariencia).
 *
 * Decide cuánto se adelanta el portal: nada para quien no usa la cámara, el
 * botón a mano para quien la usa a veces, y el panel abierto con el motor ya
 * preparado (y, si lo autoriza aparte, la cámara encendida sola) para quien
 * juega con ella.
 */
enum FacialControlUsage: string
{
    /** No usa la cámara: no se carga nada del control facial. */
    case Off = 'off';

    /** La usa a veces: los controles de cámara están a mano, cerrados. */
    case Occasional = 'occasional';

    /** Juega con la cámara: el panel sale abierto y el motor preparado. */
    case Primary = 'primary';

    /**
     * Si el usuario usa la cámara para jugar (aunque sea a veces).
     */
    public function usesCamera(): bool
    {
        return $this !== self::Off;
    }
}
