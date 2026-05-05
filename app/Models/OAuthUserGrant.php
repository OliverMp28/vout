<?php

namespace App\Models;

use App\Models\Passport\Client;
use Database\Factories\OAuthUserGrantFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;

/**
 * Consentimiento persistente de un usuario para un client OAuth.
 *
 * Materializa la decisión humana de "autorizo esta app con estos scopes"
 * de forma desacoplada de los tokens. Al revocarse desde Settings, se
 * marca `revoked_at` y se cascadan a `oauth_access_tokens` y
 * `oauth_refresh_tokens` del par (user, client) para invalidar sesiones
 * activas en el siguiente refresh.
 */
class OAuthUserGrant extends Model
{
    /** @use HasFactory<OAuthUserGrantFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'oauth_user_grants';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'client_id',
        'scopes',
        'granted_at',
        'updated_scopes_at',
        'revoked_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scopes' => 'array',
            'granted_at' => 'datetime',
            'updated_scopes_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    /**
     * Scope: sólo grants vivos (no revocados).
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('revoked_at');
    }

    /**
     * Indica si los scopes solicitados están todos cubiertos por el grant.
     * Usado por `Client::skipsAuthorization` para decidir si saltar el
     * consent screen. Si la app pide un scope nuevo no almacenado,
     * devuelve false → Passport vuelve a mostrar la pantalla (incremental
     * consent).
     *
     * @param  array<int, string>  $requestedIds
     */
    public function coversScopes(array $requestedIds): bool
    {
        return empty(array_diff($requestedIds, $this->scopes ?? []));
    }

    /**
     * Une los scopes nuevos a los existentes (union sin duplicar) y deja
     * marca temporal del último merge para distinguir en UI primer consent
     * vs expansión posterior.
     *
     * @param  array<int, string>  $newIds
     */
    public function mergeScopes(array $newIds): void
    {
        $merged = array_values(array_unique([...$this->scopes ?? [], ...$newIds]));

        $this->forceFill([
            'scopes' => $merged,
            'updated_scopes_at' => now(),
        ])->save();
    }

    /**
     * Revoca el grant y cascadea sobre todos los access/refresh tokens
     * vivos del par (user, client). Los JWT con `exp` futuro siguen
     * técnicamente válidos en clientes stateless hasta su expiración
     * natural (≤ 60min con la TTL actual), pero ningún refresh los
     * regenerará.
     */
    public function revoke(): void
    {
        $this->forceFill(['revoked_at' => now()])->save();

        Token::query()
            ->where('user_id', $this->user_id)
            ->where('client_id', $this->client_id)
            ->where('revoked', false)
            ->update(['revoked' => true]);

        RefreshToken::query()
            ->whereIn('access_token_id', Token::query()
                ->where('user_id', $this->user_id)
                ->where('client_id', $this->client_id)
                ->select('id'))
            ->where('revoked', false)
            ->update(['revoked' => true]);
    }

    /**
     * Reactiva un grant previamente revocado, reseteando timestamps.
     *
     * @param  array<int, string>  $scopes
     */
    public function reactivate(array $scopes): void
    {
        $this->forceFill([
            'scopes' => $scopes,
            'granted_at' => now(),
            'updated_scopes_at' => now(),
            'revoked_at' => null,
        ])->save();
    }

    // ─── Relaciones ──────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * `RegisteredApp` asociada al client OAuth (puede no existir si el
     * client se creó por CLI o es un PAT — ambos casos hacen que el
     * listener no cree grants, pero el accesor protege defensive).
     */
    public function registeredApp(): HasOne
    {
        return $this->hasOne(RegisteredApp::class, 'oauth_client_id', 'client_id');
    }
}
