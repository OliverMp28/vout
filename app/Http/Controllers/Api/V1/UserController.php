<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controlador de Identidad del Ecosistema Vout.
 *
 * Expone la información del usuario autenticado a las aplicaciones
 * del ecosistema (juegos propios, terceros) mediante tokens OAuth2.
 *
 * Nota para desarrolladores integradores:
 *   - Todos los endpoints requieren un Bearer Token válido emitido por Vout.
 *   - Los datos devueltos dependen de los scopes solicitados al token.
 *   - El identificador externo es siempre `vout_id` (UUID), nunca el ID interno.
 *   - Referencia completa: docs/integration-guide.md
 */
class UserController extends Controller
{
    /**
     * GET /api/v1/user/me
     *
     * Devuelve el perfil del usuario autenticado.
     * Los campos expuestos dependen de los scopes del token:
     *
     *   - user:read  → vout_id, name, username, avatar
     *   - user:email → + email
     *
     * IMPORTANTE: Nunca se expone el ID autoincremental ni datos sensibles
     * (password, 2FA, google_id, etc.) para garantizar la privacidad
     * y la seguridad cross-domain del ecosistema.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        // Datos base: siempre disponibles con scope user:read.
        $data = [
            'vout_id'  => $user->vout_id,
            'name'     => $user->name,
            'username' => $user->username,
            'avatar'   => $user->avatar,
        ];

        // Datos sensibles: solo disponibles con scope user:email.
        if ($user->tokenCan('user:email')) {
            $data['email'] = $user->email;
        }

        return response()->json(['data' => $data]);
    }
}
