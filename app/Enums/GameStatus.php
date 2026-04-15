<?php

namespace App\Enums;

/**
 * Estado de moderación de un juego enviado al catálogo de Vout.
 *
 * Aplicable principalmente a juegos enviados por desarrolladores externos
 * desde el Developer Portal (Fase 4.1). Los juegos curados internamente
 * arrancan directamente como Published.
 */
enum GameStatus: string
{
    /** Borrador privado del desarrollador, aún no enviado a revisión. */
    case Draft = 'draft';

    /** Enviado y a la espera de revisión por parte del equipo Vout. */
    case PendingReview = 'pending_review';

    /** Aprobado y visible públicamente en el catálogo. */
    case Published = 'published';

    /** Rechazado en revisión. El desarrollador puede editarlo y reenviarlo. */
    case Rejected = 'rejected';

    /**
     * Etiqueta legible internacionalizada para mostrar al usuario.
     */
    public function label(): string
    {
        return __('games.status.'.$this->value);
    }

    /**
     * Indica si el juego es visible públicamente en el catálogo.
     */
    public function isPublic(): bool
    {
        return $this === self::Published;
    }

    /**
     * Indica si el juego puede ser editado por su desarrollador.
     */
    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::PendingReview, self::Rejected], strict: true);
    }
}
