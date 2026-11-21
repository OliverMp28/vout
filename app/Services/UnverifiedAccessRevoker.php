<?php

namespace App\Services;

use App\Models\OAuthUserGrant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;

/**
 * Retira todo acceso creado sobre una cuenta cuyo email nadie había
 * demostrado poseer.
 *
 * Caso que cubre (pre-secuestro de cuenta): alguien se registra con el email
 * de otra persona sin confirmarlo; cuando la dueña real entra con Google, que
 * sí prueba la posesión del correo, Vout une ambas cosas en la misma cuenta.
 * Sin esto, quien la creó seguiría entrando con su contraseña, su 2FA, sus
 * sesiones abiertas y los tokens de las apps que autorizó.
 *
 * Quien llama decide cuándo aplica (antes de marcar el email como verificado).
 */
class UnverifiedAccessRevoker
{
    /**
     * Invalida contraseña, 2FA, "recordarme", sesiones web y tokens OAuth.
     *
     * La contraseña pasa a ser aleatoria: la dueña puede fijar una nueva con
     * "olvidé mi contraseña", que llega a su correo.
     */
    public function revoke(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $user->forceFill([
                'password' => Str::random(64),
                'remember_token' => Str::random(60),
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
            ])->save();

            OAuthUserGrant::query()
                ->where('user_id', $user->id)
                ->active()
                ->get()
                ->each(fn (OAuthUserGrant $grant) => $grant->revoke());

            RefreshToken::query()
                ->whereIn('access_token_id', Token::query()
                    ->where('user_id', $user->id)
                    ->select('id'))
                ->where('revoked', false)
                ->update(['revoked' => true]);

            Token::query()
                ->where('user_id', $user->id)
                ->where('revoked', false)
                ->update(['revoked' => true]);
        });

        $this->destroyWebSessions($user);
    }

    /**
     * Cierra las sesiones web abiertas de la cuenta.
     *
     * Solo es posible con el driver `database`: los otros drivers no indexan
     * las sesiones por usuario. No hay modelo Eloquent para esa tabla.
     */
    private function destroyWebSessions(User $user): void
    {
        if (config('session.driver') !== 'database') {
            return;
        }

        DB::connection(config('session.connection'))
            ->table(config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->delete();
    }
}
