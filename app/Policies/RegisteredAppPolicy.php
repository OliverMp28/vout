<?php

namespace App\Policies;

use App\Models\RegisteredApp;
use App\Models\User;

/**
 * Política de autorización para aplicaciones del ecosistema OAuth
 * registradas por desarrolladores en el Developer Portal (Fase 4.1).
 *
 * Cada usuario sólo puede ver, modificar o eliminar sus propias apps.
 * El listado (`viewAny`) permanece libre porque el controlador siempre
 * filtra el query por el usuario autenticado mediante el scope `ownedBy`.
 */
class RegisteredAppPolicy
{
    /**
     * Bypass global para administradores (Fase 4.2): un admin puede ver,
     * editar y eliminar cualquier app del ecosistema desde el panel interno.
     * Devolver `null` deja que la decisión recaiga en los métodos siguientes.
     */
    public function before(User $user, string $ability): ?bool
    {
        return $user->is_admin ? true : null;
    }

    /**
     * Cualquier usuario autenticado puede ver su propio listado.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * El usuario sólo accede al detalle de aplicaciones de las que es propietario.
     */
    public function view(User $user, RegisteredApp $app): bool
    {
        return $this->isOwner($user, $app);
    }

    /**
     * Cualquier usuario autenticado puede registrar una nueva aplicación.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * El usuario sólo edita aplicaciones de las que es propietario.
     */
    public function update(User $user, RegisteredApp $app): bool
    {
        return $this->isOwner($user, $app);
    }

    /**
     * El usuario sólo elimina aplicaciones de las que es propietario.
     * El controlador se encarga de revocar el client OAuth en la misma transacción.
     */
    public function delete(User $user, RegisteredApp $app): bool
    {
        return $this->isOwner($user, $app);
    }

    /**
     * Comprueba la propiedad cubriendo el caso `user_id` nulo
     * (apps creadas por seed antes de la Fase 4.1: nadie es dueño).
     */
    private function isOwner(User $user, RegisteredApp $app): bool
    {
        return $app->user_id !== null && $app->user_id === $user->id;
    }
}
