<?php

namespace App\Console\Commands;

use App\Models\RegisteredApp;
use App\Models\User;
use App\Rules\PortableOrigin;
use App\Rules\PortableUrl;
use App\Support\Audit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Laravel\Passport\ClientRepository;

/**
 * Registra una app del ecosistema con su client OAuth (Authorization Code)
 * desde CLI, sin pasar por el panel de developers.
 *
 * Pensado para el arranque de un entorno nuevo (p. ej. dar de alta Daino en
 * producción antes de que funcione el correo de verificación). Aplica las
 * mismas reglas que el formulario del panel y muestra el secreto una sola vez.
 *
 * Uso:
 *   php artisan vout:register-app Daino --owner=you@example.com --url=https://daino.vout.cloud --origin=https://daino.vout.cloud --redirect=https://daino.vout.cloud/auth/callback
 */
class RegisterAppCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'vout:register-app
                            {name : Nombre visible de la app}
                            {--owner= : Email del usuario dueño de la app}
                            {--url= : URL pública de la app (app_url)}
                            {--origin=* : Origen permitido (repetible)}
                            {--redirect=* : Redirect URI del client OAuth (repetible)}
                            {--slug= : Slug de la app (por defecto, derivado del nombre)}
                            {--public : Client público (PKCE sin secreto) en lugar de confidencial}
                            {--first-party : Marca la app como first-party (sin pantalla de consentimiento)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Registra una app del ecosistema con su client OAuth y muestra sus credenciales';

    /**
     * Execute the console command.
     */
    public function handle(ClientRepository $clients): int
    {
        $owner = User::query()->where('email', (string) $this->option('owner'))->first();

        if (! $owner) {
            $this->error('No existe un usuario con ese email (--owner).');

            return self::FAILURE;
        }

        $data = [
            'name' => (string) $this->argument('name'),
            'slug' => (string) ($this->option('slug') ?: Str::slug((string) $this->argument('name'))),
            'app_url' => (string) $this->option('url'),
            'allowed_origins' => array_values((array) $this->option('origin')),
            'redirect_uris' => array_values((array) $this->option('redirect')),
        ];

        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'slug' => ['required', 'alpha_dash', 'max:80', 'unique:registered_apps,slug'],
            'app_url' => ['required', 'string', new PortableUrl, 'max:255'],
            'allowed_origins' => ['required', 'array', 'min:1', 'max:10'],
            'allowed_origins.*' => ['required', 'string', 'distinct', new PortableOrigin, 'max:255'],
            'redirect_uris' => ['required', 'array', 'min:1', 'max:5'],
            'redirect_uris.*' => ['required', 'string', 'distinct', new PortableUrl, 'max:255'],
        ]);

        $validator->after(function ($validator) use ($data): void {
            foreach ($data['redirect_uris'] as $redirect) {
                if (! $this->belongsToAllowedOrigin($redirect, $data['allowed_origins'])) {
                    $validator->errors()->add('redirect_uris', "{$redirect} no pertenece a ningún origen permitido.");
                }
            }
        });

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $confidential = ! $this->option('public');
        $firstParty = (bool) $this->option('first-party');

        [$app, $client] = DB::transaction(function () use ($clients, $data, $owner, $confidential, $firstParty): array {
            $client = $clients->createAuthorizationCodeGrantClient(
                name: $data['name'],
                redirectUris: $data['redirect_uris'],
                confidential: $confidential,
                user: $owner,
            );

            $app = RegisteredApp::create([
                'user_id' => $owner->id,
                'name' => $data['name'],
                'slug' => $data['slug'],
                'app_url' => $data['app_url'],
                'allowed_origins' => $data['allowed_origins'],
                'is_active' => true,
                'oauth_client_id' => $client->id,
                'is_first_party' => $firstParty,
                'requires_auth' => true,
            ]);

            Audit::record(
                admin: null,
                action: 'app.registered',
                auditable: $app,
                changes: ['is_first_party' => $firstParty, 'confidential' => $confidential],
                remark: 'Disparado desde CLI (vout:register-app)',
            );

            return [$app, $client];
        });

        $this->info("App «{$app->name}» registrada (slug {$app->slug}).");
        $this->line('VOUT_CLIENT_ID='.$client->id);

        if ($client->plainSecret !== null) {
            $this->line('VOUT_CLIENT_SECRET='.$client->plainSecret);
            $this->warn('Guarda el secreto ahora: Vout solo guarda su hash. Para otro, regenéralo desde el panel de developers.');
        }

        return self::SUCCESS;
    }

    /**
     * @param  array<int, string>  $origins
     */
    private function belongsToAllowedOrigin(string $redirect, array $origins): bool
    {
        foreach ($origins as $origin) {
            $origin = rtrim($origin, '/');

            if ($redirect === $origin || str_starts_with($redirect, $origin.'/')) {
                return true;
            }
        }

        return false;
    }
}
