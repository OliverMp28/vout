<?php

namespace App\Providers;

use App\Listeners\RecordOAuthGrant;
use App\Models\Passport\Client;
use App\Models\RegisteredApp;
use App\Models\User;
use App\Passport\AccessToken as VoutAccessToken;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Passport\Events\AccessTokenCreated;
use Laravel\Passport\Passport;
use Laravel\Passport\Scope;

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
        $this->configureGates();
        $this->configureEventListeners();
    }

    /**
     * Vout IdP: registro de listeners propios sobre eventos de Passport.
     *
     * `RecordOAuthGrant` materializa el consentimiento del usuario en la
     * tabla `oauth_user_grants` cada vez que Passport emite un access
     * token (auth code, refresh, etc.). Síncrono — necesario para que la
     * pantalla de consent vea el grant en el siguiente authorize.
     */
    protected function configureEventListeners(): void
    {
        Event::listen(AccessTokenCreated::class, RecordOAuthGrant::class);
    }

    /**
     * Vout Admin: Gates globales del Panel de Administración (Fase 4.2).
     *
     * El gate `admin` es el contrato canónico para condicionar UI o lógica
     * según el rol. Las policies usan `before()` por su cuenta para que el
     * admin pase cualquier comprobación de propiedad.
     */
    protected function configureGates(): void
    {
        Gate::define('admin', fn (User $user): bool => $user->is_admin === true);
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

        // ── AccessToken con `kid` + `iss` para validación stateless ───
        // Sustituye el AccessToken bridge de Passport por el de Vout, que
        // añade `kid` (header) apuntando al JWK publicado en /oauth/jwks
        // e `iss` (claim) con la URL del IdP. Habilita la validación de
        // firma local en cualquier Resource Server que use librerías JWT
        // estándar (lcobucci/jwt, jose-jwt, node-openid-client, etc.).
        Passport::useAccessTokenEntity(VoutAccessToken::class);

        // ── Pantalla de autorización OAuth (consent screen) ───────────
        // Solo se renderiza para apps third-party. Las first-party
        // (`is_first_party=true` en `registered_apps`) saltan la pantalla
        // gracias a `Client::skipsAuthorization()`. Sin este binding,
        // Passport 13 lanza BindingResolutionException al primer GET de
        // un client externo (ver Daino / 2026-04-29).
        Passport::authorizationView(static function (array $parameters): Response {
            /** @var Client $client */
            $client = $parameters['client'];
            /** @var User $user */
            $user = $parameters['user'];
            /** @var Scope[] $scopes */
            $scopes = $parameters['scopes'];
            /** @var Request $request */
            $request = $parameters['request'];

            // Buscamos el `RegisteredApp` para enriquecer la pantalla
            // (URL del sitio del dev, marca first-party, etc.). Si no
            // existe, caemos al nombre del client OAuth — pasa cuando
            // el client se creó por CLI sin pasar por el portal.
            $app = RegisteredApp::query()
                ->where('oauth_client_id', $client->id)
                ->first();

            return Inertia::render('oauth/authorize', [
                'client' => [
                    'id' => $client->id,
                    'name' => $app?->name ?? $client->name,
                    'app_url' => $app?->app_url,
                    'is_first_party' => (bool) ($app?->is_first_party ?? false),
                ],
                'oauthUser' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar' => $user->avatar,
                    'vout_id' => $user->vout_id,
                ],
                'scopes' => array_map(static fn (Scope $scope): array => [
                    'id' => $scope->id,
                    'description' => $scope->description,
                ], $scopes),
                'authToken' => $parameters['authToken'],
                'redirectUri' => (string) $request->query('redirect_uri', ''),

                // CSRF para que los <form> nativos del consent screen lo
                // metan como hidden input. Usamos forms HTML reales (no
                // XHR de Inertia) porque OAuth callbacks son navegaciones
                // por contrato (RFC 6749 §1.7) — un XHR siguiendo el 302
                // cross-origin lo bloquea CORS. Sin esto, "Autorizar"
                // nunca llegaría al callback de un client third-party.
                'csrfToken' => $request->session()->token(),
            ]);
        });
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
