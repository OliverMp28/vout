<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\ClientRepository;

/**
 * Crea el cliente de acceso personal de Passport para el proveedor `users`.
 *
 * Este seeder es IDEMPOTENTE: si ya existe un cliente activo con el grant
 * `personal_access` y el proveedor correcto, no crea ninguno nuevo.
 * Es seguro ejecutarlo varias veces (ej. tras un `migrate:fresh --seed`).
 *
 * ─── ¿Por qué es necesario? ───────────────────────────────────────────────
 * `User::createToken()` (Passport) usa el PersonalAccessGrant, que necesita
 * un registro en `oauth_clients` con `grant_types` = `["personal_access"]`
 * y `provider` = `users`. Sin él, la llamada lanza:
 *   RuntimeException: Personal access client not found for 'users' user provider.
 *
 * `passport:install` no crea este cliente automáticamente en Passport 13:
 * hay que crearlo con `passport:client --personal --provider=users`, que es
 * exactamente lo que hace este seeder de forma programática e idempotente.
 *
 * ─── Tests ────────────────────────────────────────────────────────────────
 * `tests/TestCase.php::setUpPassport()` crea el cliente al vuelo en cada test
 * que use RefreshDatabase, por lo que la suite pasa aunque la BD de dev esté
 * vacía. Este seeder cubre el "primer arranque" del entorno de desarrollo.
 */
class PassportPersonalAccessClientSeeder extends Seeder
{
    /**
     * Proveedor de usuarios para el que se crea el cliente.
     * Debe coincidir con el guard `api` o la clave en `config/auth.php`.
     */
    private const USER_PROVIDER = 'users';

    /**
     * Nombre descriptivo del cliente. Solo se usa en la tabla `oauth_clients`
     * y en el panel de administración de Passport.
     */
    private const CLIENT_NAME = 'Vout Personal Access Client';

    public function run(): void
    {
        if ($this->personalAccessClientExists()) {
            $this->command?->line(
                '  <comment>Personal Access Client ya existe para el proveedor `'.self::USER_PROVIDER.'` — omitiendo.</comment>',
            );

            return;
        }

        app(ClientRepository::class)->createPersonalAccessGrantClient(
            self::CLIENT_NAME,
            self::USER_PROVIDER,
        );

        $this->command?->info(
            'Personal Access Client creado para el proveedor `'.self::USER_PROVIDER.'`.',
        );
    }

    /**
     * Comprueba si ya existe un cliente de acceso personal no revocado
     * para el proveedor de usuarios configurado.
     *
     * Passport 13 almacena los grants como JSON en `grant_types`.
     * El operador LIKE sobre la columna text es suficiente aquí porque
     * el único valor que contiene la cadena "personal_access" es el grant
     * correcto — no hay ambigüedad en el esquema de Passport.
     */
    private function personalAccessClientExists(): bool
    {
        return DB::table('oauth_clients')
            ->where('revoked', false)
            ->where(function ($query): void {
                $query->whereNull('provider')
                    ->orWhere('provider', self::USER_PROVIDER);
            })
            ->where('grant_types', 'LIKE', '%personal_access%')
            ->exists();
    }
}
