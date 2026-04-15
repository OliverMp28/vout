<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Audit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Promueve o revoca el rol de administrador interno (Fase 4.2).
 *
 * Bootstrap del primer admin: solo se gestiona desde CLI para evitar
 * elevación de privilegios accidental desde la UI. Cada operación queda
 * registrada en `audit_logs` con `admin_id = null` (origen CLI).
 *
 * Uso:
 *   vendor/bin/sail artisan vout:make-admin you@example.com
 *   vendor/bin/sail artisan vout:make-admin you@example.com --revoke
 */
class MakeAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'vout:make-admin
                            {email : Email del usuario a promover/revocar}
                            {--revoke : Quita el flag is_admin en lugar de añadirlo}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Promueve o revoca el rol is_admin de un usuario por email';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $revoke = (bool) $this->option('revoke');

        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            $this->error("No existe un usuario con email {$email}.");

            return self::FAILURE;
        }

        $targetState = ! $revoke;

        if ($user->is_admin === $targetState) {
            $this->warn(sprintf(
                'El usuario %s ya %s admin. Sin cambios.',
                $email,
                $targetState ? 'es' : 'no es',
            ));

            return self::SUCCESS;
        }

        DB::transaction(function () use ($user, $targetState, $revoke): void {
            $user->forceFill(['is_admin' => $targetState])->save();

            Audit::record(
                admin: null,
                action: $revoke ? 'admin.revoked' : 'admin.granted',
                auditable: $user,
                changes: ['is_admin' => $targetState],
                remark: 'Disparado desde CLI (vout:make-admin)',
            );
        });

        $this->info(sprintf(
            '%s el rol admin para %s.',
            $revoke ? 'Revocado' : 'Concedido',
            $email,
        ));

        return self::SUCCESS;
    }
}
