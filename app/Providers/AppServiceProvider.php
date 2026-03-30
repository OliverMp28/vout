<?php

namespace App\Providers;

use App\Models\Passport\Client;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Passport\Passport;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configurePassport();
    }

    /**
     * Vout IdP: Configuración centralizada de Laravel Passport.
     *
     * Toda la configuración se lee desde config/vout.php para mantener
     * la trazabilidad y evitar valores dispersos en el código.
     */
    protected function configurePassport(): void
    {
        // ── TTL de Tokens (leídos desde config/vout.php) ──────────────
        Passport::tokensExpireIn(
            now()->addMinutes(config('vout.passport.access_token_ttl_minutes'))
        );
        Passport::refreshTokensExpireIn(
            now()->addDays(config('vout.passport.refresh_token_ttl_days'))
        );
        Passport::personalAccessTokensExpireIn(
            now()->addMonths(config('vout.passport.personal_access_token_ttl_months'))
        );

        // ── Scopes del Ecosistema (leídos desde config/vout.php) ──────
        Passport::tokensCan(config('vout.scopes', []));
        Passport::defaultScopes(config('vout.default_scope', 'user:read'));

        // ── Modelo de Client extendido para Seamless SSO ──────────────
        // Las apps First-Party (is_first_party=true) saltan el prompt de autorización.
        Passport::useClientModel(Client::class);
    }

    /**
     * Configuración de comportamientos por defecto para producción.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}

