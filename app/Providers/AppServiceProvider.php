<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

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
     * Vout: Configuración centralizada de Laravel Passport IdP
     */
    protected function configurePassport(): void
    {
        \Laravel\Passport\Passport::tokensExpireIn(now()->addMinutes(config('vout.passport.access_token_ttl_minutes')));
        \Laravel\Passport\Passport::refreshTokensExpireIn(now()->addDays(config('vout.passport.refresh_token_ttl_days')));
        \Laravel\Passport\Passport::personalAccessTokensExpireIn(now()->addMonths(config('vout.passport.personal_access_token_ttl_months')));

        // Seamless SSO para First-Party Apps mediante modelo extendido
        \Laravel\Passport\Passport::useClientModel(\App\Models\Passport\Client::class);
    }

    /**
     * Configure default behaviors for production-ready applications.
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
