<?php

namespace App\Policies;

use App\Enums\GameStatus;
use App\Models\Game;
use App\Models\User;

/**
 * Política de autorización para juegos enviados por desarrolladores
 * desde el Developer Portal (Fase 4.1).
 *
 * Aplica únicamente al ciclo de vida controlado por el dev (draft,
 * pending_review, rejected, published). Los juegos curados internamente
 * (`submitted_by_user_id` nulo) quedan fuera del alcance de estas reglas:
 * no son editables ni eliminables desde el portal.
 */
class GamePolicy
{
    /**
     * Bypass global para administradores (Fase 4.2): un admin puede revisar,
     * editar (corregir typos antes de publicar) y eliminar cualquier juego
     * del catálogo desde el panel interno. Devolver `null` deja que la
     * decisión recaiga en los métodos siguientes para usuarios normales.
     */
    public function before(User $user, string $ability): ?bool
    {
        return $user->is_admin ? true : null;
    }

    /**
     * Cualquier usuario autenticado puede ver su propio listado de juegos enviados.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * El usuario sólo accede al detalle de juegos enviados por él mismo
     * (el catálogo público se sirve por otro flujo, sin pasar por esta policy).
     */
    public function view(User $user, Game $game): bool
    {
        return $this->isSubmitter($user, $game);
    }

    /**
     * Cualquier usuario autenticado puede enviar un juego al catálogo.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * El desarrollador puede editar su juego en cualquier estado del
     * ciclo de moderación. El slug público es inmutable desde la creación
     * (DeveloperGameController::update() no lo regenera jamás), así que
     * los enlaces del catálogo no se rompen aunque se edite el name u
     * otros campos tras publicarse. Borrar sí sigue bloqueado en Published.
     */
    public function update(User $user, Game $game): bool
    {
        return $this->isSubmitter($user, $game);
    }

    /**
     * El desarrollador puede eliminar su juego sólo si aún no está publicado.
     */
    public function delete(User $user, Game $game): bool
    {
        return $this->isSubmitter($user, $game)
            && $game->status !== GameStatus::Published;
    }

    /**
     * Comprueba que el usuario sea quien envió el juego al catálogo.
     */
    private function isSubmitter(User $user, Game $game): bool
    {
        return $game->submitted_by_user_id !== null
            && $game->submitted_by_user_id === $user->id;
    }
}
