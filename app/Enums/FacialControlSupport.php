<?php

namespace App\Enums;

/**
 * Si un juego admite el control facial de Vout.
 *
 * El portal no puede comprobarlo por su cuenta: con el juego en otro origen
 * no puede pulsar teclas dentro del iframe, solo avisarle de cuál pulsar
 * (`VOUT_KEY`, `VOUT_POINTER`, `VOUT_ACTION`). Que el juego lo convierta en
 * eventos solo lo sabe quien lo hizo, así que lo declara el desarrollador y
 * lo revisa el admin.
 *
 * Decide si en la página de juego se ofrece la cámara, si puede encenderse
 * sola y qué insignia lleva el juego en el catálogo.
 */
enum FacialControlSupport: string
{
    /** No recibe los controles de Vout: la cámara no haría nada. */
    case None = 'none';

    /** Recibe las teclas y los clics de Vout (con el SDK o a mano). */
    case Compatible = 'compatible';

    /** Además está pensado para jugarse con gestos de la cara. */
    case Designed = 'designed';

    /**
     * Si los gestos llegan al juego (se ofrece el control facial).
     */
    public function receivesInput(): bool
    {
        return $this !== self::None;
    }

    /**
     * Valores que admiten el control facial, para filtrar en consultas.
     *
     * @return list<string>
     */
    public static function playableWithFace(): array
    {
        return [self::Compatible->value, self::Designed->value];
    }
}
